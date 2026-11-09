@echo off
title Testing STACKZYRO CRM...
echo ===================================================
echo           STACKZYRO CRM Verification Tests
echo ===================================================

echo [1/2] Running Backend Verification Suite...
cd /d "%~dp0backend"
.\.venv\Scripts\python.exe test_crm.py
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Backend tests failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Running Frontend TypeScript Typecheck...
cd /d "%~dp0frontend"
call npm run typecheck
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend typecheck failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo [ALL CHECKS PASSED] Backend and Frontend are healthy!
echo ===================================================
pause
