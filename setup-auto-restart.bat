@echo off
chcp 65001 >nul
echo ⏰ Настройка автоматической перезагрузки серверов...
echo.

echo Установка pm2-cron модуля...
pm2 install pm2-cron

echo.
echo Удаление существующего расписания перезагрузки...
pm2 delete restart-schedule 2>nul

echo.
echo Создание нового расписания перезагрузки в 7:50 каждый день...
pm2 cron "50 7 * * *" "pm2 restart all" --name "restart-schedule"

echo.
echo Проверка созданного расписания...
pm2 list

echo.
echo ✅ Автоматическая перезагрузка настроена!
echo 📅 Время: каждый день в 7:50
echo 🔄 Команда: pm2 restart all
echo.
echo 💡 Для изменения времени измените cron выражение:
echo    "50 7 * * *" = 7:50 каждый день
echo    "0 8 * * *"  = 8:00 каждый день
echo    "30 6 * * *" = 6:30 каждый день
echo.
pause
