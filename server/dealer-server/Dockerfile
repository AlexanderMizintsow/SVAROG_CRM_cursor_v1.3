# Используйте официальный Node.js образ
FROM node:20 

# Устанавливаем рабочий каталог
WORKDIR /usr/src/app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код
COPY . .

# Открываем порт приложения
EXPOSE 5003

# Запускаем приложение
CMD ["node", "index.js"]
