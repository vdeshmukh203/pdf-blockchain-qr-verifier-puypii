@echo off
echo Blockchain Document Verifier
echo =============================
echo.
where node >nul 2>&1
if %errorlevel% equ 0 (
  echo Starting with Node.js...  press Ctrl+C to stop.
  echo.
  echo NOTE: If Windows Firewall asks about Node.js network access, click "Allow".
  echo       This is required for Bitcoin ^(OTS^) anchoring to work.
  echo.
  node "%~dp0server.js" 2>&1
) else (
  where python >nul 2>&1
  if %errorlevel% equ 0 (
    echo Starting with Python...  press Ctrl+C to stop.
    echo.
    python "%~dp0server.py" 2>&1
  ) else (
    echo ERROR: Neither Node.js nor Python was found on this computer.
    echo.
    echo  Install Node.js ^(free^) from:  https://nodejs.org
    echo  Choose the LTS version, run the installer, then try again.
    echo.
    echo  If you already have Node.js installed, try restarting your
    echo  computer so Windows recognises it, then run start.bat again.
  )
)
echo.
echo Press any key to close this window.
pause >nul
