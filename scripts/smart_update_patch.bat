@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: --- @PATH-REGISTRY-START (SKILL-15 Dynamic Root Anchor Walk-Up) ---
set "CURR_DIR=%~dp0"
:FindRootLoop
if exist "%CURR_DIR%.project-root" (
    set "PROJECT_ROOT=%CURR_DIR:~0,-1%"
    goto :RootFound
)
for %%I in ("%CURR_DIR%..") do set "PARENT_DIR=%%~fI"
if "%PARENT_DIR%"=="%CURR_DIR%" (
    set "PROJECT_ROOT=%~dp0.."
    goto :RootFound
)
set "CURR_DIR=%PARENT_DIR%\"
goto :FindRootLoop
:RootFound

set "SCRIPTS_DIR=%PROJECT_ROOT%\scripts\"
set "TARGET_DIR=%LOCALAPPDATA%\Programs\antigravity\resources"
:: --- @PATH-REGISTRY-END ---

echo =======================================================
echo   Antigravity Smart Update ^& Live Re-Patcher
echo =======================================================
echo.
echo Project Root     : !PROJECT_ROOT!
echo Target Directory : !TARGET_DIR!
echo.

:: Check Node.js
where node >nul 2>&1
if "%ERRORLEVEL%" NEQ "0" (
    echo [ERROR] Node.js is required to dynamically patch new versions.
    echo Please install Node.js (https://nodejs.org) or run 1_Apply_Patch.bat
    pause
    exit /b 1
)

:: Check if Antigravity is running
tasklist /FI "IMAGENAME eq Antigravity.exe" 2>nul | find /I /N "Antigravity.exe" >nul
if "%ERRORLEVEL%"=="0" (
    echo [WARNING] Antigravity is currently running.
    echo Closing Antigravity to patch files safely...
    taskkill /F /IM "Antigravity.exe" >nul 2>&1
    timeout /t 2 /nobreak >nul
)

node "!SCRIPTS_DIR!smart_patch.js"
if "%ERRORLEVEL%" NEQ "0" (
    echo [ERROR] Dynamic patching failed.
    pause
    exit /b 1
)

set /p "LAUNCH=Would you like to launch Antigravity now? (y/n): "
if /I "!LAUNCH!"=="y" (
    start "" "%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe"
)

exit /b 0