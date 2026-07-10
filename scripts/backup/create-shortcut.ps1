$WshShell = New-Object -comObject WScript.Shell
$lnkPath = "c:\Users\david\Downloads\Antigravity\Dance Manager\scripts\backup\BACKUP-NAS.lnk"
$batPath  = "c:\Users\david\Downloads\Antigravity\Dance Manager\scripts\backup\manual-backup.bat"
$workDir  = "c:\Users\david\Downloads\Antigravity\Dance Manager\scripts\backup"

$Shortcut = $WshShell.CreateShortcut($lnkPath)
$Shortcut.TargetPath      = "cmd.exe"
$Shortcut.Arguments       = "/c `"`"$batPath`"` WINDOWED`""
$Shortcut.WindowStyle     = 1   # 1 = finestra normale visibile
$Shortcut.WorkingDirectory = $workDir
$Shortcut.Save()

Write-Host "Collegamento creato: $lnkPath"
