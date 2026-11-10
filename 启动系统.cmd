@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22.12 or newer, then run this launcher again.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  call npm ci
  if errorlevel 1 (
    echo Dependency installation failed. Check your network and npm settings.
    pause
    exit /b 1
  )
)
call npm run dev -- --port 5174 --strictPort --open
pause
