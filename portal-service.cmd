@echo off
REM portal-service.cmd - Windows service entry for the AD Identity Portal (standalone build).
cd /d "%~dp0"
if not exist "C:\ProgramData\ADIdentityPortal\logs" mkdir "C:\ProgramData\ADIdentityPortal\logs"
"C:\Program Files\nodejs\node.exe" "%~dp0portal-server.cjs" >> "C:\ProgramData\ADIdentityPortal\logs\portal-service.log" 2>&1
