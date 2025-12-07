import sys
import json
import time
import requests
import os
import datetime
import glob
from io import BytesIO
from PIL import Image
import re
import html as html_lib
from PySide6.QtWidgets import (QApplication, QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                               QLineEdit, QTextEdit, QPushButton, QComboBox, 
                               QMessageBox, QFormLayout, QScrollArea, QFrame, 
                               QSizePolicy, QFileDialog, QToolButton, QDialog, QLayout,
                               QWidgetItem, QGraphicsDropShadowEffect)
from PySide6.QtGui import QPixmap, QImage, QIcon, QAction, QColor, QPalette
from PySide6.QtCore import QThread, Signal, Qt, QSize, QPoint, QRect, QEvent

# 确保输出目录存在
if getattr(sys, 'frozen', False):
    # 如果是打包后的 exe 运行，使用 exe 所在目录
    BASE_DIR = os.path.dirname(sys.executable)
else:
    # 如果是 python 脚本运行，使用脚本所在目录
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

OUTPUT_DIR = os.path.join(BASE_DIR, "zimage")
os.makedirs(OUTPUT_DIR, exist_ok=True)

CONFIG_FILE = os.path.join(BASE_DIR, "config.json")
def resource_path(name):
    if getattr(sys, 'frozen', False):
        base = getattr(sys, '_MEIPASS', BASE_DIR)
    else:
        base = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, name)

ICON_PATH = resource_path("logo.ico")
AI_AVATAR_PATH = resource_path("logo.png")
USER_AVATAR_PATH = resource_path("user_avatar.png")
SYSTEM_PROMPT_CN = "回答要简短，不要长篇大论，直接给答案。你的设定是钢铁侠的助手甲维斯。"

# --- FlowLayout Implementation ---
class FlowLayout(QLayout):
    def __init__(self, parent=None, margin=-1, hSpacing=-1, vSpacing=-1):
        super(FlowLayout, self).__init__(parent)
        if parent is not None:
            self.setContentsMargins(margin, margin, margin, margin)
        self.setSpacing(hSpacing)
        self.m_hSpace = hSpacing
        self.m_vSpace = vSpacing
        self.itemList = []

    def __del__(self):
        item = self.takeAt(0)
        while item:
            item = self.takeAt(0)

    def addItem(self, item):
        self.itemList.append(item)

    def insertWidget(self, index, widget):
        item = QWidgetItem(widget)
        self.itemList.insert(index, item)
        self.addChildWidget(widget)
        self.invalidate()

    def horizontalSpacing(self):
        if self.m_hSpace >= 0:
            return self.m_hSpace
        else:
            return self.smartSpacing(QLayout.StyleFactory.Horizontal)

    def verticalSpacing(self):
        if self.m_vSpace >= 0:
            return self.m_vSpace
        else:
            return self.smartSpacing(QLayout.StyleFactory.Vertical)

    def count(self):
        return len(self.itemList)

    def itemAt(self, index):
        if index >= 0 and index < len(self.itemList):
            return self.itemList[index]
        return None

    def takeAt(self, index):
        if index >= 0 and index < len(self.itemList):
            return self.itemList.pop(index)
        return None

    def expandingDirections(self):
        return Qt.Orientations(0)

    def hasHeightForWidth(self):
        return True

    def heightForWidth(self, width):
        height = self.doLayout(QRect(0, 0, width, 0), True)
        return height

    def setGeometry(self, rect):
        super(FlowLayout, self).setGeometry(rect)
        self.doLayout(rect, False)

    def sizeHint(self):
        return self.minimumSize()

    def minimumSize(self):
        size = QSize()
        for item in self.itemList:
            size = size.expandedTo(item.minimumSize())
        size += QSize(2 * self.contentsMargins().left(), 2 * self.contentsMargins().top())
        return size

    def doLayout(self, rect, testOnly):
        x = rect.x()
        y = rect.y()
        lineHeight = 0
        spacing = self.spacing()

        for item in self.itemList:
            wid = item.widget()
            spaceX = spacing + wid.style().layoutSpacing(QSizePolicy.PushButton, QSizePolicy.PushButton, Qt.Horizontal)
            spaceY = spacing + wid.style().layoutSpacing(QSizePolicy.PushButton, QSizePolicy.PushButton, Qt.Vertical)
            nextX = x + item.sizeHint().width() + spaceX
            if nextX - spaceX > rect.right() and lineHeight > 0:
                x = rect.x()
                y = y + lineHeight + spaceY
                nextX = x + item.sizeHint().width() + spaceX
                lineHeight = 0

            if not testOnly:
                item.setGeometry(QRect(QPoint(x, y), item.sizeHint()))

            x = nextX
            lineHeight = max(lineHeight, item.sizeHint().height())

        return y + lineHeight - rect.y()

    def smartSpacing(self, pm):
        parent = self.parent()
        if parent is None:
            return -1
        elif parent.isWidgetType():
            return parent.style().pixelMetric(pm, None, parent)
        else:
            return parent.spacing()

# --- Detail Dialog ---
class DetailDialog(QDialog):
    def __init__(self, image_source, file_path, prompt, model, resolution, parent=None):
        """
        image_source: Can be PIL Image or file path string
        """
        super().__init__(parent)
        self.setWindowTitle("Image Details (图片详情)")
        self.resize(1000, 800)
        self.setModal(True)
        self.is_fullscreen = False
        
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0) # Remove margins for better fullscreen experience
        layout.setSpacing(0) # Remove spacing between sections
        
        # Top Bar (for Close/Fullscreen when in fullscreen mode, though we use bottom buttons mostly)
        # We'll stick to bottom buttons for simplicity, but maybe add a small close button overlay later if needed.
        # For now, standard dialog frame handles closing in normal mode.
        
        # Image Display (Scrollable for large images)
        self.scroll_area = QScrollArea()
        self.scroll_area.setWidgetResizable(True)
        self.scroll_area.setAlignment(Qt.AlignCenter)
        self.scroll_area.setStyleSheet("background-color: #2c3e50; border: none;") # Dark background for better viewing
        self.scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.scroll_area.setVerticalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        
        self.image_label = QLabel()
        self.image_label.setAlignment(Qt.AlignCenter)
        
        # Load Image
        pixmap = None
        if isinstance(image_source, str): # File Path
            pixmap = QPixmap(image_source)
        else: # PIL Image
             if image_source.mode != "RGB":
                 image_source = image_source.convert("RGB")
             data = image_source.tobytes("raw", "RGB")
             qimage = QImage(data, image_source.width, image_source.height, QImage.Format_RGB888)
             pixmap = QPixmap.fromImage(qimage)

        if pixmap:
             self.original_pixmap = pixmap
             
             # Handle High DPI: Ensure 1:1 pixel mapping to avoid blurriness
             dpr = self.devicePixelRatio()
             pixmap.setDevicePixelRatio(dpr)
             
             self.image_label.setPixmap(pixmap)
             # Allow scaling? For now just show original or scaled to fit if too big?
             # Current logic just puts it in scroll area. 
             # Let's make it scale to fit window width if larger, or just original size.
             # Actually, user asked for "Full Screen", often implying "Fit to Screen".
             # But let's keep original behavior of ScrollArea for detail inspection, 
             # but maybe add "Fit to Window" later. 
             # For now, let's stick to ScrollArea as it allows zooming/panning implicitly by scrollbars.
        else:
             self.image_label.setText("Image Load Failed")

        self.scroll_area.setWidget(self.image_label)
        layout.addWidget(self.scroll_area)
        
        # Info Area
        self.info_frame = QFrame()
        self.info_frame.setStyleSheet("background-color: #f7f9fc; border-top: none;")
        info_layout = QFormLayout(self.info_frame)
        info_layout.setContentsMargins(20, 12, 20, 20)
        info_layout.setVerticalSpacing(12)
        info_layout.setLabelAlignment(Qt.AlignRight | Qt.AlignVCenter)
        info_layout.setFormAlignment(Qt.AlignLeft | Qt.AlignTop)
        
        prompt_edit = QTextEdit()
        prompt_edit.setPlainText(prompt)
        prompt_edit.setReadOnly(True)
        prompt_edit.setMaximumHeight(80)
        prompt_edit.setStyleSheet("background-color: white; border: 1px solid #ccc; color: #333;")
        
        info_layout.addRow("<b>提示词 (Prompt):</b>", prompt_edit)

        model_label = QLabel(model)
        model_label.setAlignment(Qt.AlignLeft | Qt.AlignVCenter)
        model_label.setStyleSheet("color: #2c3e50; padding: 2px 0;")
        info_layout.addRow("<b>模型 (Model):</b>", model_label)

        res_label = QLabel(resolution)
        res_label.setAlignment(Qt.AlignLeft | Qt.AlignVCenter)
        res_label.setStyleSheet("color: #2c3e50; padding: 2px 0;")
        info_layout.addRow("<b>分辨率 (Resolution):</b>", res_label)

        path_label = QLabel(file_path)
        path_label.setAlignment(Qt.AlignLeft | Qt.AlignVCenter)
        path_label.setStyleSheet("color: #2c3e50; padding: 2px 0;")
        info_layout.addRow("<b>文件路径 (File Path):</b>", path_label)
        
        self.info_frame.setVisible(False) # Default hidden
        layout.addWidget(self.info_frame)
        
        # Control Bar (Buttons)
        control_bar = QFrame()
        control_bar.setStyleSheet("""
            QFrame {
                background-color: #2c3e50; 
                border-top: 1px solid #243445;
            }
            QPushButton {
                background-color: #34495e;
                color: white;
                border: 1px solid #4e6d8d;
                border-radius: 6px;
                padding: 8px 16px;
            }
            QPushButton:hover {
                background-color: #4e6d8d;
                border-color: #5d81a8;
            }
            QPushButton:checked {
                background-color: #2980b9;
                border-color: #3498db;
            }
        """)
        btn_layout = QHBoxLayout(control_bar)
        btn_layout.setContentsMargins(10, 10, 10, 10)
        
        # Toggle Info Button
        self.info_btn = QPushButton("显示信息 (Show Info) ▲")
        self.info_btn.setCheckable(True)
        self.info_btn.clicked.connect(self.toggle_info)
        btn_layout.addWidget(self.info_btn)
        
        # Fullscreen Button
        self.fullscreen_btn = QPushButton("全屏 (Fullscreen)")
        self.fullscreen_btn.setCheckable(True)
        self.fullscreen_btn.clicked.connect(self.toggle_fullscreen)
        btn_layout.addWidget(self.fullscreen_btn)

        btn_layout.addStretch()
        
        open_file_btn = QPushButton("打开文件 (Open File)")
        open_file_btn.clicked.connect(lambda: os.startfile(file_path) if sys.platform == "win32" else None)
        btn_layout.addWidget(open_file_btn)
        
        open_folder_btn = QPushButton("打开目录 (Open Folder)")
        open_folder_btn.clicked.connect(lambda: os.startfile(os.path.dirname(file_path)) if sys.platform == "win32" else None)
        btn_layout.addWidget(open_folder_btn)
        
        close_btn = QPushButton("关闭 (Close)")
        close_btn.setStyleSheet("background-color: #c0392b; border-color: #e74c3c;") # Red for close
        close_btn.clicked.connect(self.close) # Use close instead of accept to ensure proper teardown
        btn_layout.addWidget(close_btn)
        
        layout.addWidget(control_bar)
        
        # Install Event Filter for Double Click
        self.image_label.installEventFilter(self)

    def eventFilter(self, source, event):
        if source == self.image_label and event.type() == QEvent.MouseButtonDblClick:
             if event.button() == Qt.LeftButton:
                 # Toggle Fullscreen
                 is_full = self.isFullScreen()
                 self.toggle_fullscreen(not is_full)
                 self.fullscreen_btn.setChecked(not is_full)
                 return True
        return super().eventFilter(source, event)

    def toggle_info(self, checked):
        self.info_frame.setVisible(checked)
        if checked:
            self.info_btn.setText("隐藏信息 (Hide Info) ▼")
        else:
            self.info_btn.setText("显示信息 (Show Info) ▲")

    def toggle_fullscreen(self, checked):
        if checked:
            self.showFullScreen()
            self.fullscreen_btn.setText("退出全屏 (Exit Fullscreen)")
        else:
            self.showNormal()
            self.fullscreen_btn.setText("全屏 (Fullscreen)")
            
    def keyPressEvent(self, event):
        # Allow Esc to exit fullscreen first, then close dialog
        if event.key() == Qt.Key_Escape:
            if self.isFullScreen():
                self.toggle_fullscreen(False)
                self.fullscreen_btn.setChecked(False)
            else:
                self.close()
        else:
            super().keyPressEvent(event)

# --- Worker Thread ---
class ImageGeneratorThread(QThread):
    finished = Signal(object, str, dict) # Emits PIL Image, file_path, metadata
    error = Signal(str)

    def __init__(self, api_key, model, prompt, resolution):
        super().__init__()
        self.api_key = api_key
        self.model = model
        self.prompt = prompt
        self.resolution = resolution

    def run(self):
        base_url = 'https://api-inference.modelscope.cn/'
        common_headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            # 构建请求数据
            data_payload = {
                "model": self.model,
                "prompt": self.prompt,
                "size": self.resolution # Already parsed to format "1024x1024"
            }

            response = requests.post(
                f"{base_url}v1/images/generations",
                headers={**common_headers, "X-ModelScope-Async-Mode": "true"},
                data=json.dumps(data_payload, ensure_ascii=False).encode('utf-8')
            )
            
            if response.status_code != 200:
                self.error.emit(f"API Error: {response.text}")
                return

            try:
                task_id = response.json()["task_id"]
            except KeyError:
                 self.error.emit(f"API Error (No task_id): {response.text}")
                 return
            
            while True:
                result = requests.get(
                    f"{base_url}v1/tasks/{task_id}",
                    headers={**common_headers, "X-ModelScope-Task-Type": "image_generation"},
                )
                
                if result.status_code != 200:
                    self.error.emit(f"Task Status Error: {result.text}")
                    return

                data = result.json()

                if data["task_status"] == "SUCCEED":
                    # 获取图片
                    if "output_images" in data and len(data["output_images"]) > 0:
                        img_url = data["output_images"][0]
                        img_response = requests.get(img_url)
                        img_response.raise_for_status()
                        
                        image_data = img_response.content
                        image = Image.open(BytesIO(image_data))
                        
                        # 保存图片
                        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                        filename = f"img_{timestamp}.jpg"
                        file_path = os.path.join(OUTPUT_DIR, filename)
                        image.save(file_path)

                        # 保存元数据 (JSON)
                        metadata = {
                            "filename": filename,
                            "file_path": file_path,
                            "prompt": self.prompt,
                            "model": self.model,
                            "resolution": self.resolution,
                            "timestamp": timestamp
                        }
                        json_path = file_path.rsplit('.', 1)[0] + ".json"
                        with open(json_path, "w", encoding="utf-8") as f:
                            json.dump(metadata, f, ensure_ascii=False, indent=4)
                        
                        self.finished.emit(image, file_path, metadata)
                    else:
                        self.error.emit("No output image found in response.")
                    break
                elif data["task_status"] == "FAILED":
                    self.error.emit("Image Generation Failed: " + str(data))
                    break
                
                time.sleep(2) # 轮询间隔

        except Exception as e:
            self.error.emit(str(e))

class ChatThread(QThread):
    finished = Signal(str)
    error = Signal(str)
    delta = Signal(str)

    def __init__(self, api_key, model, messages, stream=True):
        super().__init__()
        self.api_key = api_key
        self.model = model
        self.messages = messages
        self.stream = stream

    def run(self):
        try:
            base_url = 'https://api-inference.modelscope.cn/'
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": self.model,
                "messages": self.messages,
                "stream": bool(self.stream)
            }
            if self.stream:
                resp = requests.post(
                    f"{base_url}v1/chat/completions",
                    headers=headers,
                    data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
                    stream=True
                )
                if resp.status_code != 200:
                    self.error.emit(f"API Error: {resp.text}")
                    return
                acc = ""
                resp.encoding = 'utf-8'
                for raw in resp.iter_lines(decode_unicode=False):
                    if not raw:
                        continue
                    try:
                        line = raw.decode('utf-8', errors='replace').strip()
                    except Exception:
                        continue
                    if line.startswith("data:"):
                        data_str = line[len("data:"):].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            obj = json.loads(data_str)
                            delta = obj.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            if delta:
                                acc += delta
                                self.delta.emit(delta)
                        except Exception:
                            continue
                self.finished.emit(acc)
            else:
                resp = requests.post(
                    f"{base_url}v1/chat/completions",
                    headers=headers,
                    data=json.dumps(payload, ensure_ascii=False).encode('utf-8')
                )
                if resp.status_code != 200:
                    self.error.emit(f"API Error: {resp.text}")
                    return
                data = resp.json()
                try:
                    content = data["choices"][0]["message"]["content"]
                except Exception:
                    self.error.emit(f"Invalid Response: {data}")
                    return
                self.finished.emit(content)
        except Exception as e:
            self.error.emit(str(e))
# --- Image Card (Thumbnail) ---
class ImageCard(QFrame):
    clicked = Signal(object, str, str, str, str) # image_source, file_path, prompt, model, resolution

    def __init__(self, image_source, file_path, prompt, model, resolution):
        """
        image_source: Can be PIL Image or file path string
        """
        super().__init__()
        self.image_source = image_source
        self.file_path = file_path
        self.prompt = prompt
        self.model = model
        self.resolution = resolution
        
        self.setFixedSize(220, 260)
        self.setCursor(Qt.PointingHandCursor)
        self.setStyleSheet("""
            ImageCard {
                background-color: #ffffff;
                border-radius: 8px;
                border: 1px solid #e0e0e0;
            }
            ImageCard:hover {
                border: 2px solid #3498db;
                background-color: #f0f8ff;
            }
            QLabel {
                color: #333;
                border: none;
            }
        """)
        
        layout = QVBoxLayout()
        layout.setContentsMargins(10, 10, 10, 10)
        layout.setSpacing(5)
        
        # 图片显示 (缩略图)
        self.image_label = QLabel()
        self.image_label.setFixedSize(200, 200)
        self.image_label.setStyleSheet("background-color: #eee; border-radius: 4px;")
        self.image_label.setAlignment(Qt.AlignCenter)
        
        # Load and Scale Image
        pixmap = QPixmap()
        if isinstance(image_source, str): # File Path
             if os.path.exists(image_source):
                 pixmap.load(image_source)
        else: # PIL Image
            if image_source.mode != "RGB":
                image_source = image_source.convert("RGB")
            data = image_source.tobytes("raw", "RGB")
            qimage = QImage(data, image_source.width, image_source.height, QImage.Format_RGB888)
            pixmap = QPixmap.fromImage(qimage)
            
        if not pixmap.isNull():
             scaled_pixmap = pixmap.scaled(QSize(200, 200), Qt.KeepAspectRatio, Qt.SmoothTransformation)
             self.image_label.setPixmap(scaled_pixmap)
        else:
             self.image_label.setText("Error")
        
        layout.addWidget(self.image_label)
        
        # 信息显示 (文件名)
        filename = os.path.basename(file_path)
        name_label = QLabel(filename)
        name_label.setStyleSheet("font-size: 11px; color: #666;")
        name_label.setAlignment(Qt.AlignCenter)
        name_label.setWordWrap(False) # 单行显示
        
        # 截断过长的文件名
        font_metrics = name_label.fontMetrics()
        elided_text = font_metrics.elidedText(filename, Qt.ElideMiddle, 190)
        name_label.setText(elided_text)
        
        layout.addWidget(name_label)
        self.setLayout(layout)

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.clicked.emit(self.image_source, self.file_path, self.prompt, self.model, self.resolution)

class MainWindow(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("甲维斯 - 智能绘图和聊天助手（纯娱乐版）")
        if os.path.exists(ICON_PATH):
            self.setWindowIcon(QIcon(ICON_PATH))
        self.resize(1300, 850)
        self.chat_messages = []
        self.apply_styles()
        self.init_ui()
        self.load_config() # Load config on startup
        self.load_history() # Load history on startup
        self.ensure_user_avatar()

    def apply_styles(self):
        self.setStyleSheet("""
            QWidget {
                font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
                font-size: 14px;
                background-color: #f5f7fa;
                color: #333;
            }
            QGroupBox {
                border: 1px solid #dcdcdc;
                border-radius: 8px;
                margin-top: 12px;
                background-color: white;
                padding: 15px;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px;
                color: #2c3e50;
                font-weight: bold;
            }
            QLineEdit, QComboBox {
                border: 1px solid #dcdcdc;
                border-radius: 6px;
                padding: 8px;
                background-color: #ffffff;
                selection-background-color: #3498db;
                color: #333;
            }
            QComboBox QAbstractItemView {
                background-color: #ffffff;
                color: #333;
                selection-background-color: #3498db;
                selection-color: #ffffff;
                border: 1px solid #dcdcdc;
                outline: 0;
            }
            QComboBox::drop-down {
                border: none;
                width: 26px;
            }
            QTextEdit {
                border: 1px solid #dcdcdc;
                border-radius: 6px;
                padding: 8px;
                background-color: #ffffff;
                color: #333;
                selection-background-color: #3498db;
            }
            QLineEdit:focus, QComboBox:focus, QTextEdit:focus {
                border: 1px solid #3498db;
            }
            QPushButton {
                background-color: #3498db;
                color: white;
                border: none;
                border-radius: 6px;
                padding: 10px 20px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #2980b9;
            }
            QPushButton:pressed {
                background-color: #1f618d;
            }
            QPushButton:disabled {
                background-color: #bdc3c7;
            }
            QScrollArea {
                border: none;
                background-color: transparent;
            }
            /* Thin and modern scrollbars */
            QScrollBar:vertical {
                background: transparent;
                width: 8px;
                margin: 0;
            }
            QScrollBar::handle:vertical {
                background: #b9c5d1;
                min-height: 20px;
                border-radius: 4px;
            }
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
                height: 0;
                border: none;
                background: transparent;
            }
            QScrollBar:horizontal {
                background: #2c3e50;
                height: 6px;
                margin: 0;
            }
            QScrollBar::handle:horizontal {
                background: #4e6d8d;
                min-width: 20px;
                border-radius: 3px;
            }
            QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {
                width: 0;
                border: none;
                background: transparent;
            }
            QScrollBar::add-page:horizontal, QScrollBar::sub-page:horizontal {
                background: #2c3e50;
            }
        """)

    def init_ui(self):
        main_layout = QHBoxLayout()
        main_layout.setContentsMargins(20, 20, 20, 20)
        main_layout.setSpacing(20)
        
        # --- 左侧控制面板 ---
        control_panel = QWidget()
        control_panel.setStyleSheet("background:#ffffff; border:1px solid #e6eaf0; border-radius:12px;")
        control_panel.setFixedWidth(380)
        control_layout = QVBoxLayout(control_panel)
        control_layout.setContentsMargins(12, 12, 12, 12)
        
        # 标题
        title_label = QLabel("设置 (Settings)")
        title_label.setStyleSheet("font-size: 20px; font-weight: bold; color: #2c3e50; margin-bottom: 10px;")
        control_layout.addWidget(title_label)
        
        # 表单区域
        form_widget = QWidget()
        form_widget.setStyleSheet("background-color: white; border-radius: 10px; padding: 10px;")
        form_layout = QFormLayout(form_widget)
        form_layout.setSpacing(15)
        
        # API Key
        self.api_key_input = QLineEdit("")
        self.api_key_input.setEchoMode(QLineEdit.Password)
        
        self.toggle_api_btn = QPushButton("👁")
        self.toggle_api_btn.setFixedSize(30, 30)
        self.toggle_api_btn.setCheckable(True)
        self.toggle_api_btn.setStyleSheet("""
            QPushButton { background-color: #ecf0f1; color: #555; padding: 0; }
            QPushButton:checked { background-color: #bdc3c7; }
        """)
        self.toggle_api_btn.toggled.connect(self.toggle_api_visibility)
        
        api_key_layout = QHBoxLayout()
        api_key_layout.addWidget(self.api_key_input)
        api_key_layout.addWidget(self.toggle_api_btn)
        
        form_layout.addRow("密钥 (API Key):", api_key_layout)
        
        # 模型分类与模型
        self.model_category_combo = QComboBox()
        self.model_category_combo.addItems(["绘画模型 (Image)", "对话模型 (Chat)"])
        self.model_category_combo.currentIndexChanged.connect(self.on_model_category_changed)
        form_layout.addRow("模型分类 (Category):", self.model_category_combo)

        self.image_models = ["Qwen/Qwen-Image", "Tongyi-MAI/Z-Image-Turbo"]
        self.chat_models = [
            "deepseek-ai/DeepSeek-V3.2",
            "Qwen/Qwen3-235B-A22B-Instruct-2507"
        ]

        self.model_combo = QComboBox()
        form_layout.addRow("模型 (Model):", self.model_combo)
        
        # Resolution
        self.resolution_combo = QComboBox()
        def ratio_cn(r):
            return "方形" if r == "1:1" else ("横屏" if r in ("4:3","16:9","3:2","21:9") else "竖屏")
        categories = [
            ("标准 (Standard)", [
                {"ratio": "1:1", "size": "512x512"},
                {"ratio": "3:4", "size": "768x1024"},
                {"ratio": "4:3", "size": "640x480"},
                {"ratio": "16:9", "size": "640x360"},
                {"ratio": "9:16", "size": "360x640"},
                {"ratio": "3:2", "size": "720x480"},
                {"ratio": "2:3", "size": "480x720"},
                {"ratio": "21:9", "size": "840x360"},
            ]),
            ("高清 (HD)", [
                {"ratio": "1:1", "size": "1024x1024"},
                {"ratio": "3:4", "size": "1152x1536"},
                {"ratio": "4:3", "size": "1280x960"},
                {"ratio": "16:9", "size": "1600x900"},
                {"ratio": "9:16", "size": "900x1600"},
                {"ratio": "3:2", "size": "1536x1024"},
                {"ratio": "2:3", "size": "1024x1536"},
                {"ratio": "21:9", "size": "1680x720"},
            ]),
            ("超清 (Ultra)", [
                {"ratio": "1:1", "size": "2048x2048"},
                {"ratio": "3:4", "size": "1536x2048"},
                {"ratio": "4:3", "size": "2048x1536"},
                {"ratio": "16:9", "size": "2048x1152"},
                {"ratio": "9:16", "size": "1152x2048"},
                {"ratio": "3:2", "size": "2048x1365"},
                {"ratio": "2:3", "size": "1365x2048"},
                {"ratio": "21:9", "size": "2048x876"},
            ]),
        ]
        self.resolution_combo.clear()
        for cat, items in categories:
            self.resolution_combo.addItem(f"--- {cat} ---")
            self.resolution_combo.model().item(self.resolution_combo.count()-1).setEnabled(False)
            for it in items:
                text = f"{it['size']} ({it['ratio']} {ratio_cn(it['ratio'])})"
                self.resolution_combo.addItem(text)

        default_index = self.resolution_combo.findText("1024x1024 (1:1 方形)")
        if default_index >= 0:
            self.resolution_combo.setCurrentIndex(default_index)
        self.res_label = QLabel("分辨率 (Resolution):")
        form_layout.addRow(self.res_label, self.resolution_combo)
        
        control_layout.addWidget(form_widget)
        
        # Prompt
        prompt_label = QLabel("提示词 (Prompt):")
        prompt_label.setStyleSheet("font-weight: bold; margin-top: 10px;")
        control_layout.addWidget(prompt_label)
        
        self.prompt_input = QTextEdit()
        self.prompt_input.setPlaceholderText("请输入提示词... (Enter your prompt here)")
        # 强制样式
        self.prompt_input.setStyleSheet("""
            QTextEdit {
                background-color: white;
                color: #333;
                border: 1px solid #dcdcdc;
                border-radius: 10px;
                padding: 10px;
                font-size: 14px;
            }
            QTextEdit:focus {
                border: 1px solid #3498db;
            }
        """)
        self.prompt_input.setMinimumHeight(150)
        self.prompt_input.installEventFilter(self)
        control_layout.addWidget(self.prompt_input)
        
        # Generate Button
        self.generate_btn = QPushButton("生成图像 (Generate Image)")
        self.generate_btn.setCursor(Qt.PointingHandCursor)
        self.generate_btn.setMinimumHeight(50)
        self.generate_btn.setStyleSheet("""
            QPushButton {
                background-color: #3498db;
                color: white;
                border-radius: 8px;
                font-size: 16px;
                font-weight: bold;
            }
            QPushButton:hover { background-color: #2980b9; }
            QPushButton:pressed { background-color: #1f618d; }
            QPushButton:disabled { background-color: #bdc3c7; }
        """)
        self.generate_btn.clicked.connect(self.on_send_action)
        control_layout.addWidget(self.generate_btn)
        
        # Status
        self.status_label = QLabel("就绪 (Ready)")
        self.status_label.setAlignment(Qt.AlignCenter)
        self.status_label.setStyleSheet("color: #7f8c8d; margin-top: 10px;")
        control_layout.addWidget(self.status_label)
        
        control_layout.addStretch()
        
        # --- 右侧结果展示区 ---
        result_panel = QWidget()
        result_panel.setStyleSheet("background:#f6f8fb; border:1px solid #e6eaf0; border-radius:12px;")
        result_layout = QVBoxLayout(result_panel)
        result_layout.setContentsMargins(12, 12, 12, 12)
        
        self.result_title = QLabel("生成记录 (Gallery)")
        self.result_title.setStyleSheet("font-size: 20px; font-weight: bold; color: #2c3e50; margin-bottom: 10px;")
        result_layout.addWidget(self.result_title)
        
        # 滚动区域
        self.scroll_area = QScrollArea()
        self.scroll_area.setWidgetResizable(True)
        self.scroll_area.setStyleSheet("background-color: transparent; border: none;")
        
        self.gallery_container = QWidget()
        self.gallery_container.setStyleSheet("background-color: transparent;")
        
        # 使用 FlowLayout
        self.gallery_layout = FlowLayout(self.gallery_container, margin=10, hSpacing=15, vSpacing=15)
        
        self.scroll_area.setWidget(self.gallery_container)
        result_layout.addWidget(self.scroll_area)

        # 对话滚动区域
        self.chat_scroll_area = QScrollArea()
        self.chat_scroll_area.setWidgetResizable(True)
        self.chat_scroll_area.setStyleSheet("background-color: transparent; border: none;")
        self.chat_container = QWidget()
        self.chat_container.setStyleSheet("background-color: transparent;")
        self.chat_layout = QVBoxLayout(self.chat_container)
        self.chat_layout.setContentsMargins(10, 10, 10, 10)
        self.chat_layout.setSpacing(10)
        self.chat_scroll_area.setWidget(self.chat_container)
        result_layout.addWidget(self.chat_scroll_area)
        self.chat_scroll_area.hide()
        
        # 添加布局
        main_layout.addWidget(control_panel)
        main_layout.addWidget(result_panel, 1)
        
        self.setLayout(main_layout)
        self.on_model_category_changed()

    def load_config(self):
        """Load settings from config.json."""
        if not os.path.exists(CONFIG_FILE):
            default_config = {
                "api_key": "",
                "model": "Qwen/Qwen-Image",
                "model_category": "image",
                "resolution": "1024x1024 (1:1 方形)",
                "prompt": ""
            }
            # Save default config to create the file
            try:
                with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                    json.dump(default_config, f, indent=4, ensure_ascii=False)
            except Exception as e:
                print(f"Error creating default config: {e}")
            self.config = default_config
        else:
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    self.config = json.load(f)
            except Exception as e:
                print(f"Error loading config: {e}")
                self.config = {}

        # Apply config to UI
        if "api_key" in self.config:
            self.api_key_input.setText(self.config["api_key"])
        
        if "model_category" in self.config:
            cat = self.config["model_category"]
            self.model_category_combo.setCurrentIndex(0 if cat == "image" else 1)
            self.on_model_category_changed()
        if "model" in self.config:
            index = self.model_combo.findText(self.config["model"])
            if index >= 0:
                self.model_combo.setCurrentIndex(index)
        
        if "resolution" in self.config:
            index = self.resolution_combo.findText(self.config["resolution"]) 
            if index >= 0:
                self.resolution_combo.setCurrentIndex(index)
                
        if "prompt" in self.config:
            self.prompt_input.setPlainText(self.config["prompt"])

    def save_config(self):
        """Save current settings to config.json."""
        self.config = {
            "api_key": self.api_key_input.text().strip(),
            "model": self.model_combo.currentText(),
            "model_category": "image" if self.model_category_combo.currentIndex() == 0 else "chat",
            "resolution": self.resolution_combo.currentText(),
            "prompt": self.prompt_input.toPlainText()
        }
        try:
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(self.config, f, indent=4, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving config: {e}")

    def closeEvent(self, event):
        """Save config on app close."""
        self.save_config()
        event.accept()

    def load_history(self):
        """Load images from the output directory on startup."""
        if not os.path.exists(OUTPUT_DIR):
            return
            
        # Find all images
        image_files = []
        for ext in ["*.jpg", "*.jpeg", "*.png"]:
            image_files.extend(glob.glob(os.path.join(OUTPUT_DIR, ext)))
            
        # Sort by modification time (newest first)
        image_files.sort(key=os.path.getmtime, reverse=True)
        
        for img_path in image_files:
            # Try to find corresponding JSON
            json_path = img_path.rsplit('.', 1)[0] + ".json"
            prompt = "Unknown (未知)"
            model = "Unknown"
            resolution = "Unknown"
            
            if os.path.exists(json_path):
                try:
                    with open(json_path, "r", encoding="utf-8") as f:
                        metadata = json.load(f)
                        prompt = metadata.get("prompt", prompt)
                        model = metadata.get("model", model)
                        resolution = metadata.get("resolution", resolution)
                except Exception as e:
                    print(f"Error reading JSON for {img_path}: {e}")
            
            # Create Card (Pass path instead of PIL Image to save memory on load)
            card = ImageCard(img_path, img_path, prompt, model, resolution)
            card.clicked.connect(self.show_detail_dialog)
            self.gallery_layout.addWidget(card)

    def toggle_api_visibility(self, checked):
        if checked:
            self.api_key_input.setEchoMode(QLineEdit.Normal)
            self.toggle_api_btn.setText("🔒")
        else:
            self.api_key_input.setEchoMode(QLineEdit.Password)
            self.toggle_api_btn.setText("👁")

    def on_model_category_changed(self):
        is_image = self.model_category_combo.currentIndex() == 0
        self.model_combo.clear()
        if is_image:
            self.model_combo.addItems(self.image_models)
            self.res_label.show()
            self.resolution_combo.show()
            self.scroll_area.show()
            self.chat_scroll_area.hide()
            self.result_title.setText("生成记录 (Gallery)")
            self.generate_btn.setText("生成图像 (Generate Image)")
        else:
            self.model_combo.addItems(self.chat_models)
            self.res_label.hide()
            self.resolution_combo.hide()
            self.scroll_area.hide()
            self.chat_scroll_area.show()
            self.result_title.setText("对话记录 (Chat)")
            self.generate_btn.setText("发送消息 (Send Message)")

    def on_send_action(self):
        if self.model_category_combo.currentIndex() == 0:
            self.start_generation()
        else:
            self.start_chat()

    def start_chat(self):
        self.save_config()
        api_key = self.api_key_input.text().strip()
        model = self.model_combo.currentText()
        content = self.prompt_input.toPlainText().strip()
        if not content:
            QMessageBox.warning(self, "警告 (Warning)", "请输入消息 (Please enter a message).")
            return
        self.ensure_system_prompt()
        user_msg = {"role": "user", "content": content}
        self.chat_messages.append(user_msg)
        self.add_chat_message("用户", content)
        self.prompt_input.clear()
        self.prompt_input.setFocus()
        assistant_label = self.add_chat_message("助手", "")
        self.current_assistant_label = assistant_label
        self.current_assistant_acc = ""
        self.generate_btn.setEnabled(False)
        self.generate_btn.setText("发送中... (Sending...)")
        self.status_label.setText("对话请求已发送... (Chat request sent...)")
        self.chat_thread = ChatThread(api_key, model, self.chat_messages, stream=True)
        self.chat_thread.finished.connect(self.on_chat_finished)
        self.chat_thread.error.connect(self.on_chat_error)
        self.chat_thread.delta.connect(self.on_chat_delta)
        self.chat_thread.start()

    def ensure_system_prompt(self):
        if not self.chat_messages or self.chat_messages[0].get("role") != "system":
            self.chat_messages.insert(0, {"role": "system", "content": SYSTEM_PROMPT_CN})

    def eventFilter(self, source, event):
        try:
            if source == self.prompt_input and event.type() == QEvent.KeyPress:
                if event.key() in (Qt.Key_Return, Qt.Key_Enter):
                    is_chat = self.model_category_combo.currentIndex() == 1
                    if is_chat and not (event.modifiers() & Qt.ShiftModifier):
                        self.start_chat()
                        return True
        except Exception:
            pass
        return super().eventFilter(source, event)

    def add_chat_message(self, author, text):
        is_assistant = (author == "助手")
        row = QWidget()
        row_layout = QHBoxLayout(row)
        row_layout.setContentsMargins(10, 6, 10, 6)
        row_layout.setSpacing(8)

        avatar_label = QLabel()
        avatar_label.setFixedSize(36, 36)
        if is_assistant and os.path.exists(AI_AVATAR_PATH):
            pm = QPixmap(AI_AVATAR_PATH)
        elif is_assistant and os.path.exists(ICON_PATH):
            pm = QPixmap(ICON_PATH)
        else:
            pm = QPixmap(USER_AVATAR_PATH) if os.path.exists(USER_AVATAR_PATH) else QPixmap()
        if not pm.isNull():
            pm = pm.scaled(36, 36, Qt.KeepAspectRatio, Qt.SmoothTransformation)
            avatar_label.setPixmap(pm)
        avatar_label.setStyleSheet("border-radius:18px; background:#dfe7ef;")

        bubble = QFrame()
        bubble.setFrameShape(QFrame.NoFrame)
        bubble.setLineWidth(0)
        max_w = int(self.chat_scroll_area.viewport().width() * 0.6) if self.chat_scroll_area else 600
        bubble_layout = QHBoxLayout(bubble)
        bubble_layout.setContentsMargins(14, 10, 14, 10)
        bubble_layout.setSpacing(8)

        body = QLabel()
        body.setWordWrap(True)
        body.setTextFormat(Qt.RichText)
        body.setOpenExternalLinks(True)
        body.setText(self.render_markdown(text))
        body.setStyleSheet("background: transparent; margin:0; padding:0;")
        fm = body.fontMetrics()
        calc_w = fm.horizontalAdvance(text) + 40
        bubble_w = min(max_w, max(240, calc_w))
        if is_assistant and (text is None or text == ""):
            bubble_w = max_w
        bubble.setFixedWidth(bubble_w)
        bubble.setSizePolicy(QSizePolicy.Fixed, QSizePolicy.Minimum)

        shadow = QGraphicsDropShadowEffect()
        shadow.setBlurRadius(8)
        shadow.setOffset(0, 2)
        shadow.setColor(QColor(0, 0, 0, 30))
        bubble.setGraphicsEffect(shadow)

        if is_assistant:
            bubble.setStyleSheet("QFrame{background:#f1f3f6; border:1px solid #e1e5ea; border-radius:12px;} QLabel{color:#2c3e50; font-size:14px; background: transparent; border: none;}")
            row_layout.setAlignment(Qt.AlignLeft)
            row_layout.addWidget(avatar_label)
            row_layout.setAlignment(avatar_label, Qt.AlignTop)
            row_layout.addWidget(bubble)
            row_layout.setAlignment(bubble, Qt.AlignTop)
        else:
            bubble.setStyleSheet("QFrame{background:#4e8df5; border:1px solid #4e8df5; border-radius:12px;} QLabel{color:#ffffff; font-size:14px;}")
            row_layout.setAlignment(Qt.AlignRight)
            row_layout.addWidget(bubble)
            row_layout.setAlignment(bubble, Qt.AlignTop)
            row_layout.addWidget(avatar_label)
            row_layout.setAlignment(avatar_label, Qt.AlignTop)

        bubble_layout.addWidget(body)
        self.chat_layout.addWidget(row)
        self.chat_scroll_area.verticalScrollBar().setValue(self.chat_scroll_area.verticalScrollBar().maximum())
        return body

    def on_chat_delta(self, delta_text):
        if getattr(self, "current_assistant_label", None) is not None:
            self.current_assistant_acc = getattr(self, "current_assistant_acc", "") + delta_text
            self.current_assistant_label.setText(self.render_markdown(self.current_assistant_acc))
            self.chat_scroll_area.verticalScrollBar().setValue(self.chat_scroll_area.verticalScrollBar().maximum())

    def ensure_user_avatar(self):
        try:
            if not os.path.exists(USER_AVATAR_PATH):
                url = "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&s=96"
                r = requests.get(url, timeout=10)
                if r.status_code == 200:
                    with open(USER_AVATAR_PATH, "wb") as f:
                        f.write(r.content)
        except Exception:
            pass

    def render_markdown(self, text):
        s = text
        s = html_lib.escape(s)
        s = re.sub(r"```([\s\S]*?)```", lambda m: f"<pre style='background:#f6f8fa;border:1px solid #e1e4e8;border-radius:6px;padding:8px;white-space:pre-wrap;'>{m.group(1)}</pre>", s)
        s = re.sub(r"`([^`]+)`", r"<code style='background:#f6f8fa;border:1px solid #e1e4e8;border-radius:4px;padding:2px 4px;'>\1</code>", s)
        s = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", s)
        s = re.sub(r"_([^_]+)_", r"<i>\1</i>", s)
        s = re.sub(r"\\\(([^)]*)\\\)", r"<i>\1</i>", s)
        s = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r"<a href='\2' style='color:#2d8cf0;text-decoration:none;'>\1</a>", s)
        s = s.replace("\n", "<br/>")
        return s

    def on_chat_finished(self, assistant_text):
        self.chat_messages.append({"role": "assistant", "content": assistant_text})
        if getattr(self, "current_assistant_label", None) is not None:
            self.current_assistant_label.setText(self.render_markdown(assistant_text))
            self.current_assistant_acc = assistant_text
            self.chat_scroll_area.verticalScrollBar().setValue(self.chat_scroll_area.verticalScrollBar().maximum())
            self.current_assistant_label = None
        else:
            self.add_chat_message("助手", assistant_text)
        self.generate_btn.setEnabled(True)
        self.generate_btn.setText("发送消息 (Send Message)")
        self.status_label.setText("就绪 (Ready)")

    def on_chat_error(self, msg):
        QMessageBox.critical(self, "错误 (Error)", msg)
        self.generate_btn.setEnabled(True)
        self.generate_btn.setText("发送消息 (Send Message)")
        self.status_label.setText("发生错误 (Error Occurred)")

    def start_generation(self):
        self.save_config() # Save config before generation
        api_key = self.api_key_input.text().strip()
        model = self.model_combo.currentText()
        prompt = self.prompt_input.toPlainText().strip()
        # Parse resolution from combo box text (e.g., "1024*1024 (1:1 Square)" -> "1024x1024")
        resolution_text = self.resolution_combo.currentText()
        if resolution_text.startswith("---"):
            QMessageBox.warning(self, "警告 (Warning)", "请选择有效的分辨率 (Please select a valid resolution).")
            return
            
        resolution = resolution_text.split(' ')[0].replace("*", "x")
        
        if not prompt:
            QMessageBox.warning(self, "警告 (Warning)", "请输入提示词 (Please enter a prompt).")
            return

        self.generate_btn.setEnabled(False)
        self.generate_btn.setText("生成中... (Generating...)")
        self.status_label.setText("请求已发送，等待响应... (Request sent...)")
        
        self.thread = ImageGeneratorThread(api_key, model, prompt, resolution)
        self.thread.finished.connect(self.on_generation_finished)
        self.thread.error.connect(self.on_generation_error)
        self.thread.start()

    def on_generation_finished(self, pil_image, file_path, metadata):
        self.status_label.setText("生成成功! (Success!)")
        self.generate_btn.setEnabled(True)
        self.generate_btn.setText("生成图像 (Generate Image)")
        
        prompt = metadata.get("prompt", "")
        model = metadata.get("model", "")
        resolution = metadata.get("resolution", "")
        
        # Create Image Card
        card = ImageCard(pil_image, file_path, prompt, model, resolution)
        card.clicked.connect(self.show_detail_dialog)
        
        # Insert at top using the new helper method
        self.gallery_layout.insertWidget(0, card)
        
        # Scroll to top
        self.scroll_area.verticalScrollBar().setValue(0)

    def show_detail_dialog(self, image_source, file_path, prompt, model, resolution):
        dialog = DetailDialog(image_source, file_path, prompt, model, resolution, self)
        dialog.exec()

    def on_generation_error(self, error_msg):
        self.status_label.setText("发生错误 (Error Occurred)")
        self.generate_btn.setEnabled(True)
        self.generate_btn.setText("生成图像 (Generate Image)")
        QMessageBox.critical(self, "错误 (Error)", error_msg)

if __name__ == "__main__":
    try:
        QApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
        QApplication.setAttribute(Qt.AA_UseHighDpiPixmaps, True)
    except Exception:
        pass
    app = QApplication(sys.argv)
    app.setStyle("Fusion")
    try:
        if os.path.exists(ICON_PATH):
            app.setWindowIcon(QIcon(ICON_PATH))
    except Exception:
        pass
    window = MainWindow()
    window.show()
    sys.exit(app.exec())
