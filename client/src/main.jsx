import ReactDOM from "react-dom/client";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

//Scalable Virtual Automation & Resource Orchestration Grid
//Масштабируемая система виртуальной автоматизации и управления ресурсами
//git add .         git commit -m "env"      git push

// git status     git restore .     git pull origin main   -  обновить из гитхаба

//npm uninstall -g pm2       npm install -g pm2

// *** Установка для серверов node.js pm2 и автозапуска
/*

1. npm install -g pm2 - утсановка 
2. npm install pm2-windows-startup -g
3. pm2-startup install - регистрация в реестре

4. pm2 start index.js --name "tg-dealer-bot" --- запуск билда
5. pm2 save
6. pm2 list

- pm2 stop tg-dealer-bot - остановить приложение  pm2 stop all - остановить все    pm2 delete all - вообще все удалить из запуска и потом делать заного
- pm2 kill  - остановить все процессы и сам пм2
- pm2 restart 2     -  перезапуск по id для обновления   pm2 restart all
- pm2 logs <имя_или_id_процесса>


cd server
cd asterisk_server
pm2 start asterisk.js --name "asterisk-server"
cd ..
cd AW
pm2 start index.js --name "aw-server"
cd ..
cd CRM-server
pm2 start index.js --name "CRM-server"
cd ..
cd dealer-server
pm2 start index.js --name "dealer-server"
cd ..
cd register 
pm2 start index.js --name "register-service"
cd ..
cd telegram_dealer_bot 
pm2 start index.js --name "telegram_dealer_bot-server"
cd ..
cd tg-bot-server
pm2 start index.js --name "tg-bot-server" 
cd ..
cd email-service
pm2 start index.js --name "email-service"
cd ..

cd mobile_staff_app
pm2 start index.js --name "mobile_staff_app"
cd ..


cd business_process_engine
pm2 start index.js --name "business_process_engine"
cd ..

cd mobile_app
pm2 start index.js --name "mobile_app"
cd ..

cd ..
cd client
pm2 serve dist 5173 --spa --name SVAROG
pm2 save
pm2 list

*/

// Запуск клиента в билде на сервер
/*
1. npm run build
 */

// Запустить клиент
/*
1. npm run build
  
*/

// НОВЫЕ pm2
/*

# Остановка и удаление существующих процессов
pm2 stop all
pm2 delete all

# Запуск серверов
cd server/asterisk_server; pm2 start asterisk.js --name "asterisk-server"; cd ../..
cd server/AW; pm2 start index.js --name "aw-server"; cd ../..
cd server/CRM-server; pm2 start index.js --name "CRM-server"; cd ../..
cd server/dealer-server; pm2 start index.js --name "dealer-server"; cd ../..
cd server/register; pm2 start index.js --name "register-service"; cd ../..
cd server/telegram_dealer_bot; pm2 start index.js --name "telegram_dealer_bot-server"; cd ../..
cd server/tg-bot-server; pm2 start index.js --name "tg-bot-server"; cd ../..
cd server/email-service; pm2 start index.js --name "email-service"; cd ../..
cd client; pm2 serve dist 5173 --spa --name "SVAROG"; cd ..

# Сохранение конфигурации
pm2 save

# Создание задачи в Windows Task Scheduler
schtasks /create /tn "SVAROG-Restart" /tr "pm2 restart all" /sc daily /st 07:50 /f



# Проверка серверов
pm2 list

# Проверка расписания
schtasks /query /tn "SVAROG-Restart"

# Изменить на 8:00
schtasks /change /tn "SVAROG-Restart" /st 08:00

# Изменить на 6:30
schtasks /change /tn "SVAROG-Restart" /st 06:30

schtasks /delete /tn "SVAROG-Restart" /f

pm2 stop all
pm2 delete all
pm2 save

*/

// *** Ветки Git: main, bp_project_block, crm_development
/*
СОЗДАТЬ ветку CRM (от bp_project_block, где уже много сделано):
  git checkout bp_project_block
  git pull origin bp_project_block
  git checkout -b crm_development

ПЕРЕКЛЮЧИТЬСЯ между ветками:
  git checkout main
  git checkout bp_project_block
  git checkout crm_development

СОХРАНИТЬ изменения перед переключением:
  git add .
  git commit -m "описание"

ОБЪЕДИНИТЬ ветки (когда всё готово):
  git checkout main
  git merge crm_development
  git merge bp_project_block
  git push origin main
*/



//  cd C:\caddy
//  .\caddy.exe reload --config Caddyfile