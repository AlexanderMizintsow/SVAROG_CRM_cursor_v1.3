@echo off
chcp 65001 >nul
echo 🛑 Остановка всех серверов SVAROG...
echo.

echo Остановка всех процессов PM2...
pm2 stop all

echo.
echo Удаление всех процессов PM2...
pm2 delete all

echo.
echo Очистка конфигурации PM2...
pm2 save

echo.
echo 📋 Статус процессов:
pm2 list

echo.
echo ✅ Все серверы остановлены!
echo.
pause
