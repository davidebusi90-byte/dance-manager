' Dance Manager - Backup NAS
' Questo file viene aperto da Stream Deck e lancia il backup con finestra visibile.

Dim objShell
Set objShell = CreateObject("WScript.Shell")

Dim batPath
batPath = "c:\Users\david\Downloads\Antigravity\Dance Manager\scripts\backup\manual-backup.bat"

' Lancia cmd.exe con la finestra visibile (parametro 1 = finestra normale)
' Il parametro WINDOWED evita il loop di auto-rilancio nel .bat
objShell.Run "cmd.exe /c """ & batPath & """ WINDOWED", 1, False

Set objShell = Nothing
