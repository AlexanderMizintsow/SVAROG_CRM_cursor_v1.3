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
EXPOSE 5004

# Команда, которая будет выполнена при запуске контейнера
CMD ["node", "index.js"]
 