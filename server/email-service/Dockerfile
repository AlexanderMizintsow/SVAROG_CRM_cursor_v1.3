
# Выбираем базовый образ с Node.js
FROM node:20 

# Устанавливаем рабочую директорию в контейнере
WORKDIR /app

# Копируем все файлы package.json и package-lock.json в директорию /app
COPY package*.json ./

# Устанавливаем зависимости проекта, включая bcrypt, cors, dotenv, express, express-rate-limit, express-validator, helmet, jsonwebtoken, multer, pg
RUN npm install

# Копируем все файлы проекта в директорию /app
COPY . .

# Определяем порт, который будет открыт в контейнере
EXPOSE 5001

# Команда, которая будет выполнена при запуске контейнера
CMD ["node", "index.js"]

#docker build -t register-app .
#  docker run -p 5001:5001 -d register-app


#Пересоберите образ Docker для вашего приложения, запустив команду:
 
#    docker build -t email-server .
#    После успешного завершения сборки образа, перезапустите контейнер, используя новую версию образа:
 
#   docker stop <container_id>   // Остановка текущего контейнера
#   docker rm <container_id>     // Удаление текущего контейнера
#   docker run -p 5001:5001 -d email-server   // Запуск новой версии контейнера
#  docker run -p 5001:5001 -d --name v.0.2 email-server   // Запуск новой версии контейнера
