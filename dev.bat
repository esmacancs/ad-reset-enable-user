@echo off
cd /d "%~dp0"
node node_modules\next\dist\bin\next dev -p 3000 -H 0.0.0.0
