@echo off
chcp 65001 >nul
call "%~dp0scripts\smart_update_patch.bat" %*
exit /b %ERRORLEVEL%
