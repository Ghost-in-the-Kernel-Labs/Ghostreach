@echo off
rem Ghostreach from this folder, for a copy of its source (GR-018): ghostreach, ghostreach --help, ghostreach <site>.
rem The first time, it installs the program's packages from the lockfile and builds it, saying so. The installed package has
rem its own command, so this file is not packed. npm link once in this folder makes ghostreach work in any folder.
setlocal
set "HERE=%~dp0"
if exist "%HERE%dist\cli\bin.js" goto run
echo Ghostreach is not built in this folder yet. Building it once now (this takes a minute)...
pushd "%HERE%"
if not exist node_modules call npm ci --no-audit --no-fund
if not exist node_modules goto failed
call npm run build --silent
popd
if not exist "%HERE%dist\cli\bin.js" goto failed
:run
node "%HERE%dist\cli\bin.js" %*
exit /b %ERRORLEVEL%
:failed
echo Could not build Ghostreach. It needs Node.js 24 (or 22.18 or later) and npm 11. Copy the message above to Ghost.
exit /b 1
