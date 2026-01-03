@echo off

REM Go to script directory
cd /D "%~dp0"

REM Print banner (only if file exists)
if exist ".\public\banner.txt" (
  type ".\public\banner.txt"
) else (
  echo (banner missing: .\public\banner.txt)
)


REM Ensure origin exists and points to the right repo (set once or repair)
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin https://github.com/zvxnz7/marand.git
) else (
  git remote set-url origin https://github.com/zvxnz7/marand.git
)

echo.
echo Updating repository...
git stash
git pull
if errorlevel 1 (
  echo Git pull failed.
  pause
  exit /b 1
)

REM Install dependencies only if needed
if not exist "node_modules" (
  echo Installing npm dependencies...
  npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Starting app...
call npm start

pause
