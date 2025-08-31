@echo off
chcp 65001 >nul
echo 🗑️ Удаление автоматической перезагрузки...
echo.

echo Удаление задачи из Windows Task Scheduler...
schtasks /delete /tn "SVAROG-Restart" /f

echo.
echo Удаление временного скрипта...
del "%TEMP%\restart-servers.bat" 2>nul

echo.
echo ✅ Автоматическая перезагрузка удалена!
echo.
pause
