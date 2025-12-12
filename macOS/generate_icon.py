import os
import json
import subprocess
import sys

def generate_icons(source_image_path):
    if not os.path.exists(source_image_path):
        print(f"Error: Source image '{source_image_path}' not found.")
        return

    base_dir = "z-image/Assets.xcassets/AppIcon.appiconset"
    if not os.path.exists(base_dir):
        os.makedirs(base_dir)

    # Define the required sizes for macOS
    # (Size in points, Scale)
    sizes = [
        (16, 1), (16, 2),
        (32, 1), (32, 2),
        (128, 1), (128, 2),
        (256, 1), (256, 2),
        (512, 1), (512, 2),
        (1024, 1), (1024, 2),

    ]

    images_json = []

    # Process macOS icons
    for point_size, scale in sizes:
        pixel_size = point_size * scale
        filename = f"icon_{point_size}x{point_size}_{scale}x.png"
        filepath = os.path.join(base_dir, filename)
        
        # Use sips to resize (standard macOS tool)
        cmd = ["sips", "-z", str(pixel_size), str(pixel_size), source_image_path, "--out", filepath]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)
        
        images_json.append({
            "size": f"{point_size}x{point_size}",
            "idiom": "mac",
            "filename": filename,
            "scale": f"{scale}x"
        })

    # Add a 1024x1024 icon for App Store (universal) - Note: 512pt @ 2x covers this, but sometimes a separate marketing icon is kept.
    # However, for macOS 'mac' idiom, 512x512@2x IS the 1024x1024 icon. 
    # The warning "Unknown idiom value 'ios'" suggests we should NOT add an ios entry.
    # We will skip adding the explicit 'ios' 1024 entry as it's redundant/invalid for this target.
    
    contents = {
        "images": images_json,
        "info": {
            "version": 1,
            "author": "xcode"
        }
    }

    with open(os.path.join(base_dir, "Contents.json"), "w") as f:
        json.dump(contents, f, indent=2)

    print("✅ Icons generated successfully in " + base_dir)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 generate_icon.py <path_to_source_image>")
        sys.exit(1)
    
    generate_icons(sys.argv[1])
