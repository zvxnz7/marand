@echo off
setlocal

cd /D "%~dp0"

echo === UPDATE ONLY (GitHub -> Server) ===

REM Ensure origin is correct (edit if needed)
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin https://github.com/zvxnz7/marand.git
) else (
  git remote set-url origin https://github.com/zvxnz7/marand.git
)

echo Fetching...
git fetch --all --prune
if errorlevel 1 (
  echo ERROR: git fetch failed
  exit /b 1
)

echo Resetting to origin/main...
git reset --hard origin/main
if errorlevel 1 (
  echo ERROR: git reset failed (maybe branch is master?)
  exit /b 1
)

echo Cleaning...
git clean -fd
if errorlevel 1 (
  echo ERROR: git clean failed
  exit /b 1
)

echo Installing deps...
if exist package-lock.json (
  call npm ci
) else (
  call npm install
)

if errorlevel 1 (
  echo ERROR: npm ci/install failed
  exit /b 1
)

echo Restarting PM2 process "marand"...
call pm2 restart marand
if errorlevel 1 (
  echo ERROR: pm2 restart failed (is your pm2 process named marand?)
  exit /b 1
)

echo DONE
exit /b 0
