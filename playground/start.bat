@echo off
title SAM Audio Playground (Production)

echo Building frontend...
cd /d %~dp0frontend
call npm run build
if %errorlevel% neq 0 (
    echo Frontend build failed!
    pause
    exit /b 1
)

echo.
echo Starting SAM Audio Playground...
echo.

:: Start backend in a new window with conda env
start "SAM Audio Backend" cmd /k "call conda activate sam-audio && cd /d %~dp0backend && python server.py"

timeout /t 3 /nobreak >nul

:: Start frontend production server in a new window
start "SAM Audio Frontend" cmd /k "cd /d %~dp0frontend && npm run start"

echo.
echo Backend running at http://localhost:8000
echo Frontend running at http://localhost:3000
echo.
echo Close this window or press any key to exit (servers will keep running).
pause >nul
