@echo off
:: Se non siamo ancora in una finestra dedicata, riapri questo stesso file
:: in una nuova finestra CMD visibile (fix per Stream Deck che lancia senza finestra)
if "%~1" NEQ "WINDOWED" (
    start "Dance Manager - Backup NAS" cmd /c ""%~f0" WINDOWED"
    exit /b
)

chcp 65001 >nul 2>nul

echo.
echo  ================================================
echo   Dance Manager - Backup Manuale su NAS
echo  ================================================
echo.
echo  Avvio backup in corso...
echo  Controlla che il cavo LAN sia collegato.
echo.

powershell.exe -ExecutionPolicy Bypass -WindowStyle Normal -NonInteractive -File "%~dp0run-backup.ps1"
set EXITCODE=%ERRORLEVEL%

echo.
if %EXITCODE% EQU 0 (
    echo  ================================================
    echo   OK - Backup completato con successo!
    echo  ================================================
    echo.
    echo  File salvati su:
    echo  \\TRUENAS\ArchivioRD\Iscrizioni Gare\
    echo.
) else if %EXITCODE% EQU 2 (
    echo  ================================================
    echo   SALTATO - NAS o Ethernet non disponibile
    echo  ================================================
    echo.
    echo  Possibili cause:
    echo   - Nessun cavo Ethernet collegato
    echo   - NAS TrueNAS non raggiungibile
    echo.
    echo  Riprova quando il PC e' collegato alla rete LAN.
    echo.
) else (
    echo  ================================================
    echo   ERRORE - Backup non completato
    echo  ================================================
    echo.
    echo  Controlla il log su:
    echo  \\TRUENAS\ArchivioRD\Iscrizioni Gare\{stagione}\backup.log
    echo.
)

echo  Questa finestra si chiude in 10 secondi...
ping -n 11 127.0.0.1 >nul
