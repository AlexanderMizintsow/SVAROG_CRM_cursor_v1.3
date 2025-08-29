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
