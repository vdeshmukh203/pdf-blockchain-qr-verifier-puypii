Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
strDir = FSO.GetParentFolderName(WScript.ScriptFullName)

' Start server hidden (no console window). --no-open so we control the browser ourselves.
WshShell.Run "cmd /c cd /d """ & strDir & """ && (node server.js --no-open 2>&1 || python server.py --no-open 2>&1)", 0, False

' Give server 1.2 seconds to start, then open browser.
' Works even if server was already running from a previous click.
WScript.Sleep 1200
WshShell.Run "http://localhost:7432"
