import Cocoa

guard CommandLine.arguments.count == 3 else {
    print("Usage: swift set_icon.swift <image_path> <target_file_path>")
    exit(1)
}

let imagePath = CommandLine.arguments[1]
let targetPath = CommandLine.arguments[2]

guard let image = NSImage(contentsOfFile: imagePath) else {
    print("Error: Could not load image from \(imagePath)")
    exit(1)
}

let workspace = NSWorkspace.shared
let success = workspace.setIcon(image, forFile: targetPath, options: [])

if success {
    print("✅ Icon applied successfully to \(targetPath)")
} else {
    print("❌ Failed to set icon for \(targetPath)")
    exit(1)
}
