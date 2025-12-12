#!/bin/bash

# ==========================================
# Z-Image One-Click Packaging Script
# ==========================================

set -e # Exit on error

# Configuration
APP_NAME="z-image"
SCHEME="z-image"
ICON_SOURCE="icon.png"
DIST_DIR="dist"
BUILD_DIR="build"
DMG_NAME="Z-Image-Installer.dmg"

echo "🚀 Starting Packaging Process for $APP_NAME..."

# 1. Check for icon and generate App Assets
if [ -f "$ICON_SOURCE" ]; then
    echo "🎨 Found $ICON_SOURCE, generating application icons..."
    python3 generate_icon.py "$ICON_SOURCE"
else
    echo "⚠️  Warning: $ICON_SOURCE not found. Skipping icon generation."
    echo "   (Place an 'icon.png' in the root directory to customize icons)"
fi

# 2. Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf "$BUILD_DIR"
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR/dmg_root"

# 3. Build the Application
echo "🔨 Building Release version..."
xcodebuild -scheme "$SCHEME" \
           -configuration Release \
           -derivedDataPath "$BUILD_DIR" \
           -quiet

# 4. Prepare DMG Content
echo "📦 Preparing DMG content..."
APP_PATH="$BUILD_DIR/Build/Products/Release/$APP_NAME.app"

if [ ! -d "$APP_PATH" ]; then
    echo "❌ Error: Build failed. App not found at $APP_PATH"
    exit 1
fi

cp -R "$APP_PATH" "$DIST_DIR/dmg_root/"
ln -s /Applications "$DIST_DIR/dmg_root/Applications"

# 5. Create DMG
echo "💿 Creating DMG image..."
hdiutil create -volname "$APP_NAME Installer" \
               -srcfolder "$DIST_DIR/dmg_root" \
               -ov -format UDZO \
               "$DIST_DIR/$DMG_NAME" \
               -quiet

# 6. Set DMG File Icon (if icon exists)
if [ -f "$ICON_SOURCE" ]; then
    echo "🎨 Setting DMG file icon..."
    swift set_icon.swift "$ICON_SOURCE" "$DIST_DIR/$DMG_NAME"
fi

echo "=========================================="
echo "✅ Packaging Complete!"
echo "📂 Installer: $DIST_DIR/$DMG_NAME"
echo "=========================================="

# Open the folder
open "$DIST_DIR"
