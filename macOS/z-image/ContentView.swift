//
//  ContentView.swift
//  z-image
//
//  Created by Tony on 2025/12/9.
//

import SwiftUI
import Foundation

// MARK: - Models

struct GeneratedImage: Identifiable, Codable {
    let id: UUID
    var url: URL? // Runtime URL
    let prompt: String
    let timestamp: Date
    let size: String
    let localFilename: String? // Persisted filename
    
    enum CodingKeys: String, CodingKey {
        case id, prompt, timestamp, size, localFilename
    }
    
    init(id: UUID = UUID(), url: URL?, prompt: String, timestamp: Date, size: String, localFilename: String? = nil) {
        self.id = id
        self.url = url
        self.prompt = prompt
        self.timestamp = timestamp
        self.size = size
        self.localFilename = localFilename
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        prompt = try container.decode(String.self, forKey: .prompt)
        timestamp = try container.decode(Date.self, forKey: .timestamp)
        size = try container.decode(String.self, forKey: .size)
        localFilename = try container.decodeIfPresent(String.self, forKey: .localFilename)
        
        if let filename = localFilename {
            url = HistoryManager.shared.getImageURL(filename: filename)
        } else {
            url = nil
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(prompt, forKey: .prompt)
        try container.encode(timestamp, forKey: .timestamp)
        try container.encode(size, forKey: .size)
        try container.encode(localFilename, forKey: .localFilename)
    }
}

// MARK: - History Manager

class HistoryManager {
    static let shared = HistoryManager()
    private let fileManager = FileManager.default
    
    private var documentsDirectory: URL {
        fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
    }
    
    private var imagesDirectory: URL {
        documentsDirectory.appendingPathComponent("z-image/images")
    }
    
    private var historyFile: URL {
        documentsDirectory.appendingPathComponent("z-image/history.json")
    }
    
    init() {
        try? fileManager.createDirectory(at: imagesDirectory, withIntermediateDirectories: true, attributes: nil)
    }
    
    func saveImage(data: Data) -> String? {
        let filename = "\(Int(Date().timeIntervalSince1970))_\(UUID().uuidString).png"
        let fileURL = imagesDirectory.appendingPathComponent(filename)
        do {
            try data.write(to: fileURL)
            return filename
        } catch {
            print("Failed to save image: \(error)")
            return nil
        }
    }
    
    func saveHistory(_ history: [GeneratedImage]) {
        do {
            let data = try JSONEncoder().encode(history)
            try data.write(to: historyFile)
        } catch {
            print("Failed to save history: \(error)")
        }
    }
    
    func loadHistory() -> [GeneratedImage] {
        guard fileManager.fileExists(atPath: historyFile.path) else { return [] }
        do {
            let data = try Data(contentsOf: historyFile)
            let items = try JSONDecoder().decode([GeneratedImage].self, from: data)
            return items.sorted(by: { $0.timestamp > $1.timestamp })
        } catch {
            print("Failed to load history: \(error)")
            return []
        }
    }
    
    func getImageURL(filename: String) -> URL {
        return imagesDirectory.appendingPathComponent(filename)
    }
    
    func deleteImage(filename: String) {
        let fileURL = imagesDirectory.appendingPathComponent(filename)
        try? fileManager.removeItem(at: fileURL)
    }
}

// MARK: - Main View

struct ContentView: View {
    // Persistent State
    @AppStorage("ModelScopeAPIKey") private var apiKey: String = ""
    @AppStorage("selectedModel") private var selectedModel: String = "Tongyi-MAI/Z-Image-Turbo"
    @AppStorage("selectedSize") private var selectedSize: String = "1024x1024"
    
    // UI State
    @State private var prompt: String = ""
    @State private var isGenerating: Bool = false
    @State private var errorMessage: String? = nil
    @State private var showApiKey: Bool = false
    @State private var selectedImage: GeneratedImage? // For Image Viewer
    
    // Data
    @State private var history: [GeneratedImage] = []
    
    // Alert State
    @State private var showDeleteAlert: Bool = false
    @State private var imageToDelete: GeneratedImage?
    
    // Constants
    private let endpoint = URL(string: "https://api-inference.modelscope.cn/v1/images/generations")!
    private let sizes: [(label: String, value: String)] = [
        ("正方形 1:1 (1024x1024)", "1024x1024"),
        ("横版 16:9 (1280x720)", "1280x720"),
        ("横版 16:9 (1920x1080)", "1920x1080"),
        ("竖版 9:16 (720x1280)", "720x1280"),
        ("竖版 9:16 (1080x1920)", "1080x1920"),
        ("标准 4:3 (1024x768)", "1024x768"),
        ("经典 3:2 (1200x800)", "1200x800")
    ]
    
    var body: some View {
        ZStack {
            HStack(spacing: 0) {
                // Left Sidebar
                SidebarView(
                    apiKey: $apiKey,
                    showApiKey: $showApiKey,
                    selectedModel: $selectedModel,
                    selectedSize: $selectedSize,
                    prompt: $prompt,
                    isGenerating: isGenerating,
                    errorMessage: errorMessage,
                    sizes: sizes,
                    onGenerate: {
                        Task { await generateImage() }
                    }
                )
                .frame(width: 300)
                .background(Color(NSColor.controlBackgroundColor))
                
                Divider()
                
                // Right Gallery
                GalleryView(
                    history: history,
                    isGenerating: isGenerating,
                    selectedImage: $selectedImage,
                    onDelete: { item in
                        imageToDelete = item
                        showDeleteAlert = true
                    }
                )
            }
            
            // Image Viewer Overlay
            if let image = selectedImage {
                ImageViewer(imageItem: image, selectedImage: $selectedImage)
                    .transition(.opacity)
                    .zIndex(100)
            }
        }
        .frame(minWidth: 900, minHeight: 600)
        .onAppear {
            history = HistoryManager.shared.loadHistory()
        }
        .alert("确认删除?", isPresented: $showDeleteAlert) {
            Button("删除", role: .destructive) {
                if let item = imageToDelete {
                    deleteImage(item)
                }
            }
            Button("取消", role: .cancel) {}
        } message: {
            Text("此操作将永久删除该图片及其生成记录，无法恢复。")
        }
    }
    
    func deleteImage(_ item: GeneratedImage) {
        if let index = history.firstIndex(where: { $0.id == item.id }) {
            history.remove(at: index)
            if let filename = item.localFilename {
                HistoryManager.shared.deleteImage(filename: filename)
            }
            HistoryManager.shared.saveHistory(history)
        }
    }
    
    // MARK: - API Logic
    
    struct ImageItem: Codable {
        let url: String?
        let b64_json: String?
    }
    struct ImageResponse: Codable {
        let images: [ImageItem]?
    }
    // ModelScope Specific Error Format
    struct ModelScopeError: Codable {
        let errors: ErrorInfo?
        let request_id: String?
        struct ErrorInfo: Codable {
            let message: String?
            let code: String?
        }
    }
    
    func generateImage() async {
        isGenerating = true
        errorMessage = nil
        defer { isGenerating = false }
        
        guard !apiKey.isEmpty else { errorMessage = "请设置 API Key"; return }
        let cleanPrompt = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanPrompt.isEmpty else { errorMessage = "请输入提示词"; return }
        
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        
        let body: [String: Any] = [
            "model": selectedModel,
            "prompt": cleanPrompt,
            "n": 1,
            "size": selectedSize
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body, options: [])
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let http = response as? HTTPURLResponse else {
                errorMessage = "网络请求失败，请检查网络连接。"
                return
            }
            
            guard (200..<300).contains(http.statusCode) else {
                var errorDetail = ""
                // 尝试解析具体的错误信息
                if let resp = try? JSONDecoder().decode(ModelScopeError.self, from: data) {
                    if let msg = resp.errors?.message {
                        errorDetail = msg
                    } else if let jsonStr = String(data: data, encoding: .utf8) {
                        // 如果解析失败，尝试直接显示原始 JSON（截取前200字符防止过长）
                        errorDetail = jsonStr.prefix(200) + (jsonStr.count > 200 ? "..." : "")
                    }
                } else if let jsonStr = String(data: data, encoding: .utf8) {
                    errorDetail = jsonStr.prefix(200) + (jsonStr.count > 200 ? "..." : "")
                }
                
                // 根据状态码提供更友好的提示
                switch http.statusCode {
                case 401:
                    errorMessage = "API Key 无效或过期 (401)\n\(errorDetail)"
                case 429:
                    errorMessage = "请求过于频繁，请稍后再试 (429)\n\(errorDetail)"
                case 500...599:
                    errorMessage = "服务器内部错误 (\(http.statusCode))\n\(errorDetail)"
                default:
                    errorMessage = "请求失败 (Status: \(http.statusCode))\n\(errorDetail)"
                }
                return
            }
            
            let decoded = try JSONDecoder().decode(ImageResponse.self, from: data)
            var imageData: Data?
            
            // Get Image Data
            if let urlString = decoded.images?.first?.url, let u = URL(string: urlString) {
                // Download image data
                let (downloadedData, _) = try await URLSession.shared.data(from: u)
                imageData = downloadedData
            } else if let b64 = decoded.images?.first?.b64_json, let d = Data(base64Encoded: b64) {
                imageData = d
            }
            
            if let d = imageData {
                // Save to disk
                if let filename = HistoryManager.shared.saveImage(data: d) {
                    let fileURL = HistoryManager.shared.getImageURL(filename: filename)
                    let newImage = GeneratedImage(
                        url: fileURL,
                        prompt: cleanPrompt,
                        timestamp: Date(),
                        size: selectedSize,
                        localFilename: filename
                    )
                    
                    await MainActor.run {
                        withAnimation {
                            history.insert(newImage, at: 0)
                        }
                        // Save Updated History
                        HistoryManager.shared.saveHistory(history)
                    }
                } else {
                    errorMessage = "保存图片失败"
                }
            } else {
                errorMessage = "未返回有效图片数据"
            }
        } catch {
            errorMessage = "生成失败: \(error.localizedDescription)"
        }
    }
}

// MARK: - Subviews

struct SidebarView: View {
    @Binding var apiKey: String
    @Binding var showApiKey: Bool
    @Binding var selectedModel: String
    @Binding var selectedSize: String
    @Binding var prompt: String
    var isGenerating: Bool
    var errorMessage: String?
    var sizes: [(label: String, value: String)]
    var onGenerate: () -> Void
    @State private var showErrorPopover: Bool = false
    
    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Settings Section
                    GroupBox(label: Label("设置 (Settings)", systemImage: "gearshape")) {
                        VStack(alignment: .leading, spacing: 12) {
                            // API Key
                            VStack(alignment: .leading, spacing: 4) {
                                Text("密钥 (API Key):")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                HStack {
                                    if showApiKey {
                                        TextField("sk-...", text: $apiKey)
                                            .textFieldStyle(.roundedBorder)
                                    } else {
                                        SecureField("sk-...", text: $apiKey)
                                            .textFieldStyle(.roundedBorder)
                                    }
                                    Button(action: { showApiKey.toggle() }) {
                                        Image(systemName: showApiKey ? "eye.slash" : "eye")
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            
                            // Model
                            VStack(alignment: .leading, spacing: 4) {
                                Text("模型 (Model):")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                DropdownField(options: ["Tongyi-MAI/Z-Image-Turbo", "Qwen/Qwen-Image"], selection: $selectedModel, labelProvider: { $0 })
                                    .frame(maxWidth: .infinity)
                            }
                            
                            // Resolution
                            VStack(alignment: .leading, spacing: 4) {
                                Text("分辨率 (Resolution):")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                DropdownField(options: sizes.map { $0.value }, selection: $selectedSize, labelProvider: { v in
                                    sizes.first(where: { $0.value == v })?.label ?? v
                                })
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        .padding(8)
                    }
                    
                    // Prompt Section
                    GroupBox(label: Label("提示词 (Prompt)", systemImage: "text.quote")) {
                        VStack(alignment: .leading, spacing: 8) {
                            if #available(macOS 13.0, *) {
                                TextField("请输入提示词 (Enter prompt)...", text: $prompt, axis: .vertical)
                                    .font(.body)
                                    .textFieldStyle(.plain)
                                    .lineLimit(6...12)
                                    .padding(8)
                                    .background(Color(NSColor.textBackgroundColor))
                                    .cornerRadius(4)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 4)
                                            .stroke(Color.gray.opacity(0.2), lineWidth: 1)
                                    )
                            } else {
                                TextEditor(text: $prompt)
                                    .font(.body)
                                    .padding(8)
                                    .background(Color(NSColor.textBackgroundColor))
                                    .cornerRadius(4)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 4)
                                            .stroke(Color.gray.opacity(0.2), lineWidth: 1)
                                    )
                                    .frame(minHeight: 120)
                            }
                            
                            if let error = errorMessage {
                                HStack(alignment: .top, spacing: 4) {
                                    Image(systemName: "exclamationmark.triangle.fill")
                                        .foregroundColor(.red)
                                    Text(error)
                                        .foregroundColor(.red)
                                        .font(.caption)
                                        .lineLimit(3)
                                        .multilineTextAlignment(.leading)
                                }
                                .padding(.top, 4)
                                .onTapGesture {
                                    showErrorPopover = true
                                }
                                .popover(isPresented: $showErrorPopover) {
                                    VStack(alignment: .leading, spacing: 8) {
                                        HStack {
                                            Image(systemName: "exclamationmark.triangle.fill")
                                                .foregroundColor(.red)
                                            Text("错误详情")
                                                .font(.headline)
                                        }
                                        Text(error)
                                            .font(.body)
                                            .foregroundColor(.primary)
                                            .textSelection(.enabled)
                                    }
                                    .padding()
                                    .frame(minWidth: 200, maxWidth: 400)
                                }
                                .help("点击查看完整错误信息")
                            }
                        }
                        .padding(8)
                    }
                }
                .padding()
            }
            
            // Bottom Action Area
            VStack {
                Divider()
                Button(action: onGenerate) {
                    HStack {
                        if isGenerating {
                            ProgressView()
                                .controlSize(.small)
                                Text("正在生成...")
                            } else {
                            Image(systemName: "wand.and.stars")
                            Text("生成图像 (Generate Image)")
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(isGenerating || apiKey.isEmpty || prompt.isEmpty)
                .padding()
            }
            .background(Color(NSColor.controlBackgroundColor))
        }
    }
}

struct DropdownField<Option: Hashable>: View {
    let options: [Option]
    @Binding var selection: Option
    let labelProvider: (Option) -> String
    var body: some View {
        Menu {
            ForEach(options, id: \.self) { opt in
                Button(labelProvider(opt)) { selection = opt }
            }
        } label: {
            HStack(spacing: 8) {
                Text(labelProvider(selection))
                    .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.down")
                    .foregroundColor(.secondary)
            }
            .padding(.vertical, 6)
            .padding(.horizontal, 10)
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(6)
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(Color.gray.opacity(0.2), lineWidth: 1)
            )
        }
    }
}

struct GalleryView: View {
    var history: [GeneratedImage]
    var isGenerating: Bool
    @Binding var selectedImage: GeneratedImage?
    var onDelete: (GeneratedImage) -> Void
    
    let columns = [
        GridItem(.adaptive(minimum: 200, maximum: 300), spacing: 16)
    ]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text("生成记录 (Gallery)")
                    .font(.title2)
                    .fontWeight(.semibold)
                Spacer()
                Text("\(history.count) 张图片")
                    .foregroundColor(.secondary)
            }
            .padding()
            .background(Color(NSColor.windowBackgroundColor))
            
            Divider()
            
            // Content
            ScrollView {
                LazyVGrid(columns: columns, spacing: 16) {
                    if isGenerating {
                        PlaceholderCard()
                    }
                    
                    ForEach(history) { item in
                        ImageCard(imageItem: item, onDelete: { onDelete(item) })
                            .onTapGesture {
                                selectedImage = item
                            }
                    }
                }
                .padding()
            }
            .background(Color(NSColor.controlBackgroundColor).opacity(0.5))
        }
    }
}

struct PlaceholderCard: View {
    var body: some View {
        VStack {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                .fill(Color.gray.opacity(0.1))
                .aspectRatio(1, contentMode: .fit)
                
                ProgressView()
                    .controlSize(.large)
            }
            Text("正在绘制...")
                .font(.caption)
                .foregroundColor(.secondary)
                .padding(.top, 8)
        }
    }
}

struct ImageCard: View {
    let imageItem: GeneratedImage
    var onDelete: () -> Void
    @State private var isHovering: Bool = false
    @State private var isHoveringDelete: Bool = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack {
                AsyncImage(url: imageItem.url) { phase in
                    switch phase {
                    case .empty:
                        Color.gray.opacity(0.1)
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFit()
                    case .failure:
                        ZStack {
                            Color.red.opacity(0.1)
                            Image(systemName: "exclamationmark.triangle")
                                .foregroundColor(.red)
                        }
                    @unknown default:
                        Color.gray.opacity(0.1)
                    }
                }
                
                // Hover Overlay
                if isHovering {
                    ZStack {
                        Color.black.opacity(0.1) // Subtle dimming
                        
                        VStack {
                            HStack {
                                Spacer()
                                Button(action: onDelete) {
                                    Image(systemName: "trash.circle.fill")
                                        .font(.title2)
                                        .foregroundColor(.red)
                                        .background(Color.white.clipShape(Circle()))
                                        .scaleEffect(isHoveringDelete ? 1.2 : 1.0)
                                        .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isHoveringDelete)
                                }
                                .buttonStyle(.plain)
                                .padding(8)
                                .onHover { hovering in
                                    isHoveringDelete = hovering
                                }
                            }
                            Spacer()
                            HStack {
                                Image(systemName: "arrow.up.left.and.arrow.down.right")
                                    .font(.title2)
                                    .foregroundColor(.white)
                                    .padding(6)
                                    .background(Color.black.opacity(0.5))
                                    .clipShape(Circle())
                                    .help("点击查看大图 (Click to view)")
                            }
                            .padding(.bottom, 8)
                        }
                    }
                }
            }
            .aspectRatio(1, contentMode: .fit)
            .cornerRadius(8)
            .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
            .onDrag {
                if let url = imageItem.url {
                    return NSItemProvider(contentsOf: url) ?? NSItemProvider()
                }
                return NSItemProvider()
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text(imageItem.prompt)
                    .lineLimit(1)
                    .font(.caption)
                    .foregroundColor(.primary)
                
                Text(imageItem.timestamp.formatted(date: .omitted, time: .shortened))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(8)
        .background(isHovering ? Color(NSColor.selectedControlColor).opacity(0.1) : Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isHovering ? Color.accentColor : Color.gray.opacity(0.2), lineWidth: isHovering ? 2 : 1)
        )
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.2)) {
                isHovering = hovering
            }
        }
        .contextMenu {
            Button(role: .destructive, action: onDelete) {
                Label("删除图片 (Delete)", systemImage: "trash")
            }
        }
    }
}

// MARK: - Image Viewer

struct ImageViewer: View {
    let imageItem: GeneratedImage
    @Binding var selectedImage: GeneratedImage?
    
    @State private var scale: CGFloat = 1.0
    @State private var offset: CGSize = .zero
    @State private var lastScale: CGFloat = 1.0
    @State private var lastOffset: CGSize = .zero
    @State private var showInfo: Bool = false
    @State private var isHoveringZoomIn: Bool = false
    @State private var isHoveringZoomOut: Bool = false
    
    var body: some View {
        ZStack {
            // Background Layer - catches scroll events
            ZStack {
                Color.black.opacity(0.9)
                    .edgesIgnoringSafeArea(.all)
                
                // Native Scroll Monitor (Global)
                ScrollMonitorView(scale: $scale)
            }
            .onTapGesture {
                selectedImage = nil
            }
            
            VStack(spacing: 0) {
                // Top Bar
                HStack {
                    Spacer()
                    
                    // Zoom Controls
                    HStack(spacing: 16) {
                        Button(action: { zoomOut() }) {
                            Image(systemName: "minus.magnifyingglass")
                                .font(.title2)
                                .foregroundColor(.white)
                                .scaleEffect(isHoveringZoomOut ? 1.2 : 1.0)
                                .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isHoveringZoomOut)
                        }
                        .buttonStyle(.plain)
                        .help("缩小 (Zoom Out)")
                        .onHover { hovering in
                            isHoveringZoomOut = hovering
                        }
                        
                        Text("\(Int(scale * 100))%")
                            .foregroundColor(.white)
                            .frame(width: 50)
                        
                        Button(action: { zoomIn() }) {
                            Image(systemName: "plus.magnifyingglass")
                                .font(.title2)
                                .foregroundColor(.white)
                                .scaleEffect(isHoveringZoomIn ? 1.2 : 1.0)
                                .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isHoveringZoomIn)
                        }
                        .buttonStyle(.plain)
                        .help("放大 (Zoom In)")
                        .onHover { hovering in
                            isHoveringZoomIn = hovering
                        }
                    }
                    .padding(.horizontal, 20)
                    .background(Color.black.opacity(0.5))
                    .cornerRadius(20)
                    
                    Spacer()
                    
                    Button(action: { selectedImage = nil }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.largeTitle)
                            .foregroundColor(.white.opacity(0.8))
                    }
                    .buttonStyle(.plain)
                    .padding()
                }
                .background(Color.black.opacity(0.3))
                .zIndex(1) // Keep controls on top

                // Image Area
                GeometryReader { geometry in
                    ZStack {
                        if let url = imageItem.url {
                            AsyncImage(url: url) { phase in
                                switch phase {
                                case .success(let image):
                                    image
                                        .resizable()
                                        .aspectRatio(contentMode: .fit)
                                        .scaleEffect(scale)
                                        .offset(offset)
                                        .gesture(
                                            MagnificationGesture()
                                                .onChanged { val in
                                                    let delta = val / lastScale
                                                    lastScale = val
                                                    scale *= delta
                                                }
                                                .onEnded { _ in
                                                    lastScale = 1.0
                                                    if scale < 1.0 { withAnimation { scale = 1.0 } }
                                                }
                                        )
                                        .simultaneousGesture(
                                            DragGesture()
                                                .onChanged { val in
                                                    offset = CGSize(
                                                        width: lastOffset.width + val.translation.width,
                                                        height: lastOffset.height + val.translation.height
                                                    )
                                                }
                                                .onEnded { _ in
                                                    lastOffset = offset
                                                }
                                        )
                                        .onTapGesture(count: 2) {
                                            withAnimation {
                                                scale = 1.0
                                                offset = .zero
                                                lastOffset = .zero
                                            }
                                        }
                                        .onHover { hovering in
                                            if hovering {
                                                NSCursor.openHand.push()
                                            } else {
                                                NSCursor.pop()
                                            }
                                        }
                                case .failure:
                                    Image(systemName: "exclamationmark.triangle")
                                        .foregroundColor(.red)
                                        .font(.largeTitle)
                                default:
                                    ProgressView()
                                        .preferredColorScheme(.dark)
                                }
                            }
                        }
                    }
                    .frame(width: geometry.size.width, height: geometry.size.height)
                    .clipped()
                    // Remove allowsHitTesting(false) if it was there.
                    // The background ScrollHandler catches what misses the image.
                }
                
                // Bottom Prompt Bar
                VStack(alignment: .leading, spacing: 0) {
                    Button(action: { withAnimation { showInfo.toggle() } }) {
                        HStack {
                            Text("图片信息 (Info)")
                                .font(.headline)
                                .foregroundColor(.white)
                            Spacer()
                            Image(systemName: showInfo ? "chevron.down" : "chevron.up")
                                .foregroundColor(.white)
                        }
                        .padding()
                        .background(Color.black.opacity(0.8))
                    }
                    .buttonStyle(.plain)
                    
                    if showInfo {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("提示词 (Prompt):")
                                .font(.subheadline)
                                .foregroundColor(.gray)
                            
                            ScrollView {
                                Text(imageItem.prompt)
                                    .font(.body)
                                    .foregroundColor(.white)
                                    .textSelection(.enabled)
                            }
                            .frame(maxHeight: 100)
                            
                            Divider()
                                .overlay(Color.white.opacity(0.2))
                            
                            HStack {
                                Text(imageItem.size)
                                Spacer()
                                Text(imageItem.timestamp.formatted())
                            }
                            .font(.caption)
                            .foregroundColor(.gray)
                        }
                        .padding()
                        .background(Color.black.opacity(0.8))
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                    }
                }
            }
        }
    }
    
    private func zoomIn() {
        withAnimation {
            scale = min(scale + 0.5, 5.0)
        }
    }
    
    private func zoomOut() {
        withAnimation {
            scale = max(scale - 0.5, 1.0)
            if scale == 1.0 {
                offset = .zero
                lastOffset = .zero
            }
        }
    }
}

// Helper to handle scroll wheel events using local monitor
struct ScrollMonitorView: NSViewRepresentable {
    @Binding var scale: CGFloat
    
    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        // We use a Coordinator to manage the monitor lifecycle
        return view
    }
    
    func updateNSView(_ nsView: NSView, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(scale: $scale)
    }
    
    class Coordinator {
        var scale: Binding<CGFloat>
        var monitor: Any?
        
        init(scale: Binding<CGFloat>) {
            self.scale = scale
            
            // Add local monitor for scroll events
            self.monitor = NSEvent.addLocalMonitorForEvents(matching: .scrollWheel) { [weak self] event in
                guard let self = self else { return event }
                if event.deltaY != 0 {
                    DispatchQueue.main.async {
                        let zoomFactor: CGFloat = 0.1
                        let currentScale = self.scale.wrappedValue
                        let newScale = currentScale + (event.deltaY > 0 ? zoomFactor : -zoomFactor)
                        // Use interactiveSpring for smoother continuous scrolling
                        withAnimation(.interactiveSpring()) {
                            self.scale.wrappedValue = max(1.0, min(newScale, 5.0))
                        }
                    }
                    return nil // Consume the event to prevent background scrolling
                }
                return event
            }
        }
        
        deinit {
            if let monitor = monitor {
                NSEvent.removeMonitor(monitor)
            }
        }
    }
}


#Preview {
    ContentView()
}
