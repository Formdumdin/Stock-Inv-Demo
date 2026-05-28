@echo off
setlocal

set "DEMO_FILE=%~dp0node-transaction-demo\indextransaction.html"

if not exist "%DEMO_FILE%" (
    echo Demo file not found:
    echo %DEMO_FILE%
    pause
    exit /b 1
)

start "" "%DEMO_FILE%"
