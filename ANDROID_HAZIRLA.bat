@echo off
cd /d %~dp0client
call npm install
call npm run build
call npx cap add android
call npx cap sync android
echo.
echo Android projesi hazir. Android Studio kuruluysa: npm run android:open
pause
