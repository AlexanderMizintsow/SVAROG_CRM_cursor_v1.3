@echo off
chcp 65001 >nul
echo 🚀 Запуск всех серверов SVAROG...
echo.

echo Остановка существующих процессов PM2...
pm2 stop all 2>nul
echo Удаление существующих процессов PM2...
pm2 delete all 2>nul

echo.
echo Запуск серверов...

echo 1. Запуск asterisk-server...
cd server\asterisk_server
pm2 start asterisk.js --name "asterisk-server"
cd ..\..

echo 2. Запуск aw-server...
cd server\AW
pm2 start index.js --name "aw-server"
cd ..\..

echo 3. Запуск CRM-server...
cd server\CRM-server
pm2 start index.js --name "CRM-server"
cd ..\..

echo 4. Запуск dealer-server...
cd server\dealer-server
pm2 start index.js --name "dealer-server"
cd ..\..

echo 5. Запуск register-service...
cd server\register
pm2 start index.js --name "register-service"
cd ..\..

echo 6. Запуск telegram_dealer_bot-server...
cd server\telegram_dealer_bot
pm2 start index.js --name "telegram_dealer_bot-server"
cd ..\..

echo 7. Запуск tg-bot-server...
cd server\tg-bot-server
pm2 start index.js --name "tg-bot-server"
cd ..\..

echo 8. Запуск email-service...
cd server\email-service
pm2 start index.js --name "email-service"
cd ..\..

echo 9. Запуск клиента SVAROG...
cd client
pm2 serve dist 5173 --spa --name "SVAROG"
cd ..

echo.
echo Сохранение конфигурации PM2...
pm2 save

echo.
echo Настройка автоматической перезагрузки в 7:50 каждый день...
echo Для настройки автоперезагрузки запустите setup-windows-scheduler.bat

echo.
echo 📋 Список запущенных процессов:
pm2 list

echo.
echo ✅ Все серверы успешно запущены!
echo 🔄 Автоматическая перезагрузка настроена на 7:50 каждый день
echo.
pause
