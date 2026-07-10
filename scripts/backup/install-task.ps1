#Requires -Version 5.1
<#
.SYNOPSIS
    Installa il task di backup settimanale in Windows Task Scheduler.

.DESCRIPTION
    Crea un task pianificato che:
    - Si chiama "DanceManager-Backup"
    - Gira ogni domenica alle 02:00
    - Esegue run-backup.ps1 con PowerShell
    - Viene eseguito anche se il PC e' bloccato

.NOTES
    DEVE essere eseguito come Amministratore.
    Eseguire UNA SOLA VOLTA per installare il task.
    Per disinstallare: Unregister-ScheduledTask -TaskName "DanceManager-Backup" -Confirm:$false
#>

#region Verifica Amministratore
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Questo script deve essere eseguito come Amministratore. Tasto destro > Esegui come amministratore."
    exit 1
}
#endregion

$TASK_NAME   = "DanceManager-Backup"
$SCRIPT_PATH = Join-Path $PSScriptRoot "run-backup.ps1"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Dance Manager - Installazione Backup NAS" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Script:   $SCRIPT_PATH" -ForegroundColor Gray
Write-Host "  Task:     $TASK_NAME" -ForegroundColor Gray
Write-Host "  Trigger:  Ogni domenica alle 02:00" -ForegroundColor Gray
Write-Host ""

# Verifica che lo script esista
if (-not (Test-Path $SCRIPT_PATH)) {
    Write-Error "Script non trovato: $SCRIPT_PATH"
    exit 1
}

# Rimuove il task se gia' esiste
$existing = Get-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Task esistente trovato, verra' rimpiazzato..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false
}

# ---------------------------------------------------------------------------
# Definizione azione: PowerShell esegue run-backup.ps1
# ---------------------------------------------------------------------------
$psArgs = "-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$SCRIPT_PATH`""
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument $psArgs

# ---------------------------------------------------------------------------
# Trigger: ogni domenica alle 02:00
# ---------------------------------------------------------------------------
$trigger = New-ScheduledTaskTrigger `
    -Weekly `
    -DaysOfWeek Sunday `
    -At "02:00"

# ---------------------------------------------------------------------------
# Impostazioni: gira anche se il PC e' bloccato, non richiede batteria
# ---------------------------------------------------------------------------
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -MultipleInstances IgnoreNew

# ---------------------------------------------------------------------------
# Principale: usa l'utente SYSTEM per garantire l'esecuzione senza login
# ---------------------------------------------------------------------------
$principal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

$desc = "Backup settimanale del database Dance Manager su NAS TrueNAS. Eseguito ogni domenica alle 02:00. Verifica la connessione Ethernet prima di procedere."

# Registra il task
$task = Register-ScheduledTask `
    -TaskName $TASK_NAME `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description $desc `
    -Force

if ($task) {
    Write-Host ""
    Write-Host "OK - Task installato con successo!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Prossima esecuzione:" -ForegroundColor Gray
    $nextRun = (Get-ScheduledTask -TaskName $TASK_NAME | Get-ScheduledTaskInfo).NextRunTime
    Write-Host "  $($nextRun.ToString('dddd dd MMMM yyyy HH:mm', [System.Globalization.CultureInfo]::GetCultureInfo('it-IT')))" -ForegroundColor White
    Write-Host ""
    Write-Host "  Per testare subito il backup, esegui:" -ForegroundColor Gray
    Write-Host "  Start-ScheduledTask -TaskName '$TASK_NAME'" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Per vedere i log, vai su:" -ForegroundColor Gray
    Write-Host "  \\TRUENAS\ArchivioRD\Iscrizioni Gare\{stagione}\backup.log" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Error "Registrazione del task fallita."
    exit 1
}
