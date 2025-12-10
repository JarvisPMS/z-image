# ZImage 项目

ZImage 是一个包含两个子项目的图像处理和生成平台，提供了 Web 和桌面两种使用方式。 桌面版使用Python和Swift编写。macOS的版本还整理中...


## React/TypeScript Web
![Web 应用展示](img/web.jpg)

## macOS-Swift
![macOS](img/mac11.jpg)
![macOS](img/mac22.jpg)


## Windows Python
![Python 应用展示](img/python.jpg)



## 项目结构

```
├── zimage/            # React/TypeScript Web 应用
└── zimagepython/      # Python 桌面应用
```

## 功能特点

### React/TypeScript Web 应用 (zimage/)
- 基于 Vite 构建的现代化 Web 应用
- 集成 ModelScope API 进行图像生成和对话
- 支持多种 AI 模型（包括 Z-Image-Turbo、Qwen-Image、DeepSeek-V3.2 等多种图像和对话模型）
- 丰富的分辨率选择（标准 SD、高清 HD、超高清 2K/4K）
- 支持图像生成和 AI 对话两种模式
- 支持本地存储 API 密钥
- 多语言支持（自动检测系统语言）
- 支持响应式设计，可在各种设备上使用
- 简单直观的用户界面，包含历史记录功能
- 支持下载生成的图像

### Python 桌面应用 (zimagepython/)
- 基于 PySide6 的桌面应用程序
- 支持多种 AI 模型（包括 Qwen3-235B、DeepSeek 等）
- 提供对话模型和绘画模型两种模式
- 支持流式输出和 Markdown 渲染
- 丰富的图像分辨率选择（极速、标准、高清）
- 支持历史记录和图片画廊
- 可打包为独立的 Windows 可执行文件

## 安装和运行

### Web 应用 (zimage/)

** prerequisites: Node.js **

1. 进入 Web 应用目录：
   ```bash
   cd zimage
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 配置 API 密钥：
   在 `zimage/.env.local` 文件中设置 `VITE_MODELSCOPE_API_KEY` 为您的 ModelScope API 密钥

4. 启动开发服务器：
   ```bash
   npm run dev
   ```

5. 在浏览器中访问应用程序（默认地址：http://localhost:5173）

### Python 桌面应用 (zimagepython/)

** Prerequisites: Python 3.7+ **

#### 直接运行

1. 进入 Python 应用目录：
   ```bash
   cd zimagepython
   ```

2. 安装依赖（建议使用虚拟环境）：
   ```bash
   pip install -r requirements.txt
   ```

3. 运行应用程序：
   ```bash
   python zimage_ui.py
   ```

#### 打包为可执行文件

1. 确保已安装 PyInstaller：
   ```bash
   pip install pyinstaller
   ```

2. 运行打包脚本：
   ```bash
   build_exe.bat
   ```

3. 打包后的可执行文件将在 `zimagepython/dist/` 目录下

## 使用说明

### Web 应用

#### 图像生成模式
1. 在提示词输入框中输入图像描述
2. 选择合适的模型和分辨率
3. 点击生成按钮
4. 等待图像生成完成并查看结果
5. 可以下载生成的图像或在历史记录中查看

#### AI 对话模式
1. 切换到对话模式标签
2. 在输入框中输入您的问题或对话内容
3. 选择合适的对话模型
4. 点击发送按钮
5. 查看 AI 的回复

### Python 桌面应用

#### 绘画模式
1. 选择绘画模型
2. 设置分辨率
3. 输入提示词
4. 点击生成按钮
5. 在右侧画廊查看生成的图像

#### 对话模式
1. 选择对话模型
2. 在输入框中输入对话内容
3. 点击发送按钮或按回车键
4. 查看 AI 的回复

## 配置文件说明

### Web 应用配置
- 使用 `.env.local` 文件存储 API 密钥
- 示例配置：
  ```
  VITE_MODELSCOPE_API_KEY=your_api_key_here
  ```

### Python 应用配置
- 使用 `config.json` 文件存储配置信息
- 首次运行时会自动生成
- 配置内容包括 API 密钥、默认模型、分辨率等

## 注意事项

1. **保护敏感信息**：
   - 不要将 API 密钥提交到版本控制系统
   - `.gitignore` 文件已配置为忽略包含敏感信息的配置文件

2. **模型限制**：
   - 不同模型可能有不同的使用限制和配额
   - 请参考各模型的官方文档了解详情

3. **性能考虑**：
   - 高清分辨率图像生成可能需要较长时间
   - 对话模型的流式输出可能会消耗更多资源

4. **兼容性**：
   - Web 应用需要现代浏览器支持
   - Python 桌面应用主要支持 Windows 系统

## 更新日志

### Python 应用更新
请查看 `zimagepython/UPDATE.md` 文件了解详细的更新历史。

## 许可证

本项目采用 MIT 许可证。
