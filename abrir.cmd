@echo off
cd /d "%~dp0"
if not exist node_modules call npm install --no-audit --no-fund
start "" http://127.0.0.1:5421/
node server/local.mjs
