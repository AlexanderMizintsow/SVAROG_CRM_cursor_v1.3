# Установка базового образа Node.js для этапа сборки
FROM node:16 AS build

# Установка рабочей директории внутри контейнера
WORKDIR /app

# Копирование файлов package.json и package-lock.json в контейнер
COPY client/package*.json ./

# Установка зависимостей
RUN npm install

# Копирование остальных файлов проекта в контейнер
COPY client/ ./

# Сборка приложения с помощью Vite
RUN npm run build

# Установка базового образа Nginx для хостинга собранного приложения
FROM nginx:alpine

# Копирование файлов сборки из предыдущего этапа
COPY --from=build /app/dist /usr/share/nginx/html

# Копирование пользовательского конфигурационного файла Nginx (если имеется)
COPY /nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Открытие порта 80 для доступа
EXPOSE 80

# Запуск Nginx в режиме демона
CMD ["nginx", "-g", "daemon off;"]


#docker-compose down
# docker-compose build       docker-compose build --parallel 
#docker-compose up
# docker-compose up
