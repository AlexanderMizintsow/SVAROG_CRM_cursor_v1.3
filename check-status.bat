@echo off
chcp 65001 >nul
echo 📊 Проверка статуса системы SVAROG...
echo.

echo 📋 Список всех процессов PM2:
pm2 list

echo.
echo ⏰ Проверка расписания автоматической перезагрузки:
schtasks /query /tn "SVAROG-Restart" 2>nul
if %errorlevel% neq 0 (
    echo ❌ Автоматическая перезагрузка не настроена
    echo 💡 Для настройки запустите setup-windows-scheduler.bat
) else (
    echo ✅ Автоматическая перезагрузка настроена на 7:50 каждый день
)

echo.
echo 💡 Полезные команды:
echo    pm2 restart all          - перезапустить все серверы
echo    pm2 logs [имя_сервера]   - просмотр логов
echo    pm2 monit                - мониторинг ресурсов
echo.
pause
