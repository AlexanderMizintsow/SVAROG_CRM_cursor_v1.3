@echo off
chcp 65001 >nul
echo ⏰ Настройка автоматической перезагрузки через Windows Task Scheduler...
echo.

echo Создание скрипта для перезагрузки серверов...
echo @echo off > "%TEMP%\restart-servers.bat"
echo pm2 restart all >> "%TEMP%\restart-servers.bat"

echo.
echo Удаление существующей задачи (если есть)...
schtasks /delete /tn "SVAROG-Restart" /f 2>nul

echo.
echo Создание новой задачи в Windows Task Scheduler...
schtasks /create /tn "SVAROG-Restart" /tr "%TEMP%\restart-servers.bat" /sc daily /st 07:50 /f

echo.
echo Проверка созданной задачи...
schtasks /query /tn "SVAROG-Restart"

echo.
echo ✅ Автоматическая перезагрузка настроена!
echo 📅 Время: каждый день в 7:50
echo 🔄 Команда: pm2 restart all
echo 📁 Скрипт: %TEMP%\restart-servers.bat
echo.
echo 💡 Для изменения времени используйте:
echo    schtasks /change /tn "SVAROG-Restart" /st 08:00
echo.
pause
