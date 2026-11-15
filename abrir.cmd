@echo off
cd /d "%~dp0"
start "" http://127.0.0.1:5421/
python -m http.server 5421 --bind 127.0.0.1
