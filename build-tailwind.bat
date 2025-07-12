@echo off
cd /d %~dp0
tailwindcss.exe -i css/input.css -o style.css --minify
pause
