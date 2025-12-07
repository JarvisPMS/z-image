@echo off
echo ========================================================
echo       ZImage Generator Build Script (打包脚本)
echo ========================================================

echo.
echo [1/3] Checking PyInstaller...
pip install pyinstaller -U

echo.
echo [2/3] Building EXE...
echo Clean up previous build...
rmdir /s /q build
rmdir /s /q dist
del *.spec

echo Start packing...
pyinstaller --noconsole --onefile --name "ZImage_Generator" --clean --icon logo.ico ^
    --add-data "logo.ico;." ^
    --add-data "logo.png;." ^
    --add-data "user_avatar.png;." ^
    zimage_ui.py

echo.
echo [3/3] Done!
echo.
echo The executable file is located in the "dist" folder:
echo e:\Jarvis_github\tools\zimagepython\dist\ZImage_Generator.exe
echo.
pause
