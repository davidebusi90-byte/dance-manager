@echo off
echo Avvio del server Dance Manager...
cd /d "%~dp0\.."
start "" "http://localhost:8080/dashboard"
call "C:\Program Files\nodejs\npm.cmd" run dev
pause
