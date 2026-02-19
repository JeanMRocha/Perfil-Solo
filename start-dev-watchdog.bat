@echo off
setlocal
cd /d "%~dp0"
start "PerfilSolo Dev Watchdog" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\keep-dev-server.ps1"
echo Watchdog iniciado. Acesse: http://127.0.0.1:5173
