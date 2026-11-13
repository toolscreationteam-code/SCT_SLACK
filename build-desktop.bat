@echo off
echo ========================================================
echo   AVK Workspace - Building Windows Desktop Software (.exe)
echo ========================================================
echo.

echo 1. Building Web Client...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Web client build failed!
    pause
    exit /b %errorlevel%
)

echo.
echo 2. Packaging Desktop Installer and Portable (.exe)...
call npx electron-builder --win nsis portable
if %errorlevel% neq 0 (
    echo [ERROR] Electron packaging failed!
    pause
    exit /b %errorlevel%
)

echo.
echo 3. Copying to download directory...
if not exist "public\download" mkdir "public\download"
if not exist "client\dist\download" mkdir "client\dist\download"
copy /y "dist-electron\AVK-Workspace-Setup.exe" "public\download\AVK-Workspace-Setup.exe"
copy /y "dist-electron\AVK-Workspace-Setup.exe" "public\download\AVK-Workspace-Windows.exe"
copy /y "dist-electron\AVK-Workspace-Portable.exe" "public\download\AVK-Workspace-Portable.exe"
copy /y "dist-electron\AVK-Workspace-Setup.exe" "client\dist\download\AVK-Workspace-Setup.exe"
copy /y "dist-electron\AVK-Workspace-Setup.exe" "client\dist\download\AVK-Workspace-Windows.exe"
copy /y "dist-electron\AVK-Workspace-Portable.exe" "client\dist\download\AVK-Workspace-Portable.exe"

echo.
echo ========================================================
echo   SUCCESS! AVK Workspace Desktop Software is ready!
echo   Installer: public\download\AVK-Workspace-Setup.exe
echo   Portable:  public\download\AVK-Workspace-Portable.exe
echo ========================================================
pause
