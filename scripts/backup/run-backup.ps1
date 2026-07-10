#Requires -Version 5.1
<#
.SYNOPSIS
    Backup settimanale del database Dance Manager su NAS TrueNAS.
    Viene schedulato da Windows Task Scheduler (installa con install-task.ps1).

.DESCRIPTION
    1. Verifica che il PC sia connesso via cavo Ethernet (non solo Wi-Fi)
    2. Calcola la cartella stagione corretta (es. 2025-2026 o 2026-2027)
    3. Esegue il backup tramite Node.js
    4. Scrive un log nella cartella stagione del NAS

.NOTES
    Autore : Dance Manager Backup System
    Versione: 1.0
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Configurazione
# ---------------------------------------------------------------------------
$NAS_BASE    = "\\TRUENAS\ArchivioRD\Iscrizioni Gare"
$SCRIPT_DIR  = $PSScriptRoot
$PROJECT_DIR = (Resolve-Path (Join-Path (Join-Path $SCRIPT_DIR "..") "..")).Path
$NODE_SCRIPT = Join-Path $SCRIPT_DIR "supabase-backup.mjs"
$LOG_NAME    = "backup.log"

# ---------------------------------------------------------------------------
# Funzione: Calcola stagione sportiva
# Regola: mese >= 8 (agosto) → anno-(anno+1), altrimenti (anno-1)-anno
# ---------------------------------------------------------------------------
function Get-Stagione {
    param([datetime]$Data = (Get-Date))
    $anno = $Data.Year
    $mese = $Data.Month
    if ($mese -ge 8) {
        return "$anno-$($anno + 1)"
    } else {
        return "$($anno - 1)-$anno"
    }
}

# ---------------------------------------------------------------------------
# Funzione: Scrive nel log di sistema (NAS + console)
# ---------------------------------------------------------------------------
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    $ts      = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $linea   = "[$ts] [$Level] $Message"
    Write-Host $linea

    # Prova a scrivere anche sul NAS se disponibile
    if ($script:NAS_LOG_PATH -and (Test-Path (Split-Path $script:NAS_LOG_PATH -Parent) -ErrorAction SilentlyContinue)) {
        Add-Content -Path $script:NAS_LOG_PATH -Value $linea -Encoding UTF8 -ErrorAction SilentlyContinue
    }
}

# ---------------------------------------------------------------------------
# STEP 1: Verifica connessione Ethernet attiva
# ---------------------------------------------------------------------------
function Test-EthernetConnected {
    $adapters = Get-NetAdapter -Physical -ErrorAction SilentlyContinue |
        Where-Object { $_.Status -eq 'Up' -and $_.MediaType -match 'Ethernet|802\.3' }

    if ($adapters) {
        Write-Log "Ethernet attivo: $($adapters | Select-Object -First 1 -ExpandProperty Name)"
        return $true
    }

    Write-Log "Nessun adattatore Ethernet attivo trovato. Backup saltato." "WARN"
    return $false
}

# ---------------------------------------------------------------------------
# STEP 2: Verifica che il NAS sia raggiungibile
# ---------------------------------------------------------------------------
function Test-NASReachable {
    param([string]$NasPath)
    try {
        if (Test-Path $NasPath -ErrorAction SilentlyContinue) {
            Write-Log "NAS raggiungibile tramite rete: $NasPath"
            return $true
        }
    } catch {}
    Write-Log "NAS non raggiungibile (percorso non trovato): $NasPath" "WARN"
    return $false
}

# ---------------------------------------------------------------------------
# STEP 3: Verifica che Node.js sia installato
# ---------------------------------------------------------------------------
function Test-NodeInstalled {
    try {
        $ver = & node --version 2>&1
        Write-Log "Node.js trovato: $ver"
        return $true
    } catch {
        Write-Log "Node.js non trovato nel PATH. Installa Node.js e riprova." "ERROR"
        return $false
    }
}

# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
$exitCode = 0

try {
    $now      = Get-Date
    $stagione = Get-Stagione -Data $now

    # Percorso log sul NAS (cartella stagione)
    $nasStaginDir    = Join-Path $NAS_BASE $stagione
    $script:NAS_LOG_PATH = Join-Path $nasStaginDir $LOG_NAME

    Write-Log "=== Dance Manager Backup ==="
    Write-Log "Data:     $($now.ToString('dd/MM/yyyy HH:mm'))"
    Write-Log "Stagione: $stagione"
    Write-Log "NAS:      $nasStaginDir"

    # --- Check 1: Ethernet ---
    if (-not (Test-EthernetConnected)) {
        Write-Log "Uscita anticipata: nessun Ethernet." "WARN"
        exit 2   # 2 = saltato (no Ethernet)
    }

    # --- Check 2: NAS ---
    if (-not (Test-NASReachable -NasPath $NAS_BASE)) {
        Write-Log "Uscita anticipata: NAS non raggiungibile." "WARN"
        exit 2   # 2 = saltato (NAS non raggiungibile)
    }

    # Crea cartella stagione se non esiste
    if (-not (Test-Path $nasStaginDir)) {
        New-Item -ItemType Directory -Path $nasStaginDir -Force | Out-Null
        Write-Log "Creata cartella stagione: $nasStaginDir"
    }

    # --- Check 3: Node.js ---
    if (-not (Test-NodeInstalled)) {
        exit 1
    }

    # --- Esegue il backup ---
    Write-Log "Avvio script Node.js..."
    $nodeArgs = "`"$NODE_SCRIPT`" --dest `"$nasStaginDir`""

    $proc = Start-Process -FilePath "node" `
                          -ArgumentList $nodeArgs `
                          -WorkingDirectory $PROJECT_DIR `
                          -NoNewWindow `
                          -Wait `
                          -PassThru

    if ($proc.ExitCode -eq 0) {
        Write-Log "✅ Backup completato con successo." "INFO"
    } else {
        Write-Log "⚠️  Backup completato con errori (exit code: $($proc.ExitCode))." "WARN"
        $exitCode = $proc.ExitCode
    }

} catch {
    Write-Log "❌ Errore fatale: $($_.Exception.Message)" "ERROR"
    $exitCode = 2
}

Write-Log "=== Fine ==="
exit $exitCode
