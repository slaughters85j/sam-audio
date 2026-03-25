@echo off
title SAM Audio Playground (Dev)

echo Starting SAM Audio Playground...
echo.

:: Start backend in a new window with conda env
start "SAM Audio Backend" cmd /k "call conda activate sam-audio && cd /d %~dp0backend && python server.py"

:: Wait a moment for backend to begin loading
timeout /t 3 /nobreak >nul

:: Start frontend dev server in a new window
start "SAM Audio Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Backend starting at http://localhost:8000
echo Frontend starting at http://localhost:3000
echo.
echo Close this window or press any key to exit (servers will keep running).
pause >nul
