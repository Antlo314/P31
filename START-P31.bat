@echo off
title Proverbs 31 Marketplace
rem The REAL path, not the LUMENCOMMAND\P31 junction. Vite 8 resolves
rem modules to their realpath and then rejects them as outside the
rem project root when the server was started from the junction —
rem "Failed to load url /src/main.jsx ... Does the file exist?" on a
rem file that plainly exists. Starting from the real path sidesteps it.
cd /d "C:\Users\aarons\.gemini\antigravity\scratch\P31"
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
echo.
echo  Proverbs 31 Marketplace  http://127.0.0.1:5195
echo  Rise ^& Build - a faith-led marketplace under the Lumen flag.
echo.
rem --host 127.0.0.1 is not optional. Vite defaults to "localhost", which on
rem this machine resolves to ::1 and binds IPv6 ONLY — the site loads fine in
rem a browser while the deck's probe of http://127.0.0.1:5195 gets
rem ECONNREFUSED, so the orb sits dark next to a working app.
call npm run dev -- --host 127.0.0.1 --port 5195 --strictPort
pause
