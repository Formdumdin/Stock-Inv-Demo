@echo off
setlocal

set "DEMO_DIR=%~dp0node-location-demo"
set "DEMO_FILE=%DEMO_DIR%\index.html"

if not exist "%DEMO_FILE%" (
    echo Demo file not found:
    echo %DEMO_FILE%
    pause
    exit /b 1
)

start "" "%DEMO_FILE%"
