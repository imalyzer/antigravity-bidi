@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

set "TARGET_DIR=%LOCALAPPDATA%\Programs\antigravity\resources"
set "BACKUP_DIR=%~dp0..\backup"

echo =======================================================
echo   Antigravity Restore Original (Factory Condition)
echo =======================================================
echo.

set "SOURCE_BACKUP="
if exist "!TARGET_DIR!\app.asar.backup_before_patch" (
    set "SOURCE_BACKUP=!TARGET_DIR!\app.asar.backup_before_patch"
) else if exist "!BACKUP_DIR!\app.asar.original" (
    set "SOURCE_BACKUP=!BACKUP_DIR!\app.asar.original"
)

if "!SOURCE_BACKUP!"=="" (
    echo [ERROR] No factory backup found!
    echo Looked for:
    echo   1. !TARGET_DIR!\app.asar.backup_before_patch
    echo   2. !BACKUP_DIR!\app.asar.original
    pause
    exit /b 1
)

:: Check if Antigravity is running
tasklist /FI "IMAGENAME eq Antigravity.exe" 2>nul | find /I /N "Antigravity.exe" >nul
if "%ERRORLEVEL%"=="0" (
    echo [WARNING] Antigravity is currently running.
    echo Closing Antigravity safely...
    taskkill /F /IM "Antigravity.exe" >nul 2>&1
    timeout /t 2 /nobreak >nul
)

echo [1/2] Restoring original app.asar from backup...
copy /Y "!SOURCE_BACKUP!" "!TARGET_DIR!\app.asar" >nul
if "%ERRORLEVEL%" NEQ "0" (
    echo [ERROR] Failed to restore app.asar. Check permissions.
    pause
    exit /b 1
)

echo [2/2] Restoring unpacked dependencies if available...
if exist "!BACKUP_DIR!\app.asar.unpacked" (
    robocopy "!BACKUP_DIR!\app.asar.unpacked" "!TARGET_DIR!\app.asar.unpacked" /E /NFL /NDL /NJH /NJS /nc /ns /np >nul
)

echo.
echo =======================================================
echo   FACTORY RESTORE COMPLETE!
echo =======================================================
echo   Antigravity has been returned to its factory state.
echo.
pause
exit /b 0
