@echo off
title Starting STACKZYRO CRM...
echo ===================================================
echo           Starting STACKZYRO CRM Services
echo ===================================================

echo [1/3] Starting Backend API (FastAPI) on port 8000...
start "STACKZYRO Backend" cmd /k "cd /d "%~dp0backend" && .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"

echo [2/3] Starting Frontend (Vite React) on port 5173...
start "STACKZYRO Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo [3/3] Opening browser at http://localhost:5173 ...
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo ===================================================
echo STACKZYRO CRM is running!
echo URL: http://localhost:5173
echo.
echo Login Credentials:
echo   - Admin: admin@stackzyro.com / Admin@123
echo   - Staff: ayesha@stackzyro.com / Staff@123
echo ===================================================
pause
