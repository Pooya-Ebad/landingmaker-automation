@echo off
cd /d "%~dp0"
if not exist node_modules\ (
  call npm.cmd ci --cache .npm-cache
  if errorlevel 1 exit /b 1
)
if not exist dist\index.html (
  call npm.cmd run build
  if errorlevel 1 exit /b 1
)
call npm.cmd start
