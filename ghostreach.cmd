@echo off
rem Ghostreach from this folder, for a copy of its source (GR-018): ghostreach, ghostreach --help, ghostreach <site>.
rem scripts\launch.mjs installs the packages from the lockfile and builds the program when this copy is new or was updated (a
rem git pull), saying so in one line, and does nothing when nothing changed (J-070); then the program runs. The installed package
rem has its own command, so this file is not packed. npm link once in this folder makes ghostreach work in any folder.
setlocal
set "HERE=%~dp0"
where node >nul 2>nul || goto nonode
node "%HERE%scripts\launch.mjs"
if errorlevel 1 exit /b 1
node "%HERE%dist\cli\bin.js" %*
exit /b %ERRORLEVEL%
:nonode
echo Ghostreach needs Node.js 24 (or 22.18 or later). Copy this message to Ghost.
exit /b 1
