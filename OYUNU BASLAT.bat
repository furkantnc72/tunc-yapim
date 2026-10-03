@echo off
cd /d "%~dp0"
if not exist server\node_modules (cd server && call npm install && cd ..)
if not exist client\node_modules (cd client && call npm install && cd ..)
start "101 Server" cmd /k "cd /d %~dp0server && npm start"
timeout /t 3 /nobreak >nul
start "101 Client" cmd /k "cd /d %~dp0client && npm run dev -- --host 0.0.0.0"
timeout /t 3 /nobreak >nul
start http://localhost:5173
