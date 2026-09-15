@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Please install Node.js 22 or later.
  pause
  exit /b 1
)
node "%~dp0scripts\publish.cjs"
set "upload_result=%errorlevel%"
pause
exit /b %upload_result%
