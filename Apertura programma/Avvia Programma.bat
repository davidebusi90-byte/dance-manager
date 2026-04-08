@echo off
title Dance Manager - Dev Server
cd /d "%~dp0.."
echo Avvio del server di sviluppo...
echo Il programma si aprirà automaticamente nel browser.
start http://127.0.0.1:8080
npm run dev
pause
