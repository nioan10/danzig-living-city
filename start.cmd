@echo off
cd /d "%~dp0"
set "DANZIG_NODE=node"
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "DANZIG_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
start "" "http://127.0.0.1:4173"
"%DANZIG_NODE%" server.js
if errorlevel 1 pause
