# Используйте базовый образ
FROM debian:latest

# Установите Asterisk и его зависимости
RUN apt-get update && \
    apt-get install -y asterisk

# Откройте порты Asterisk
EXPOSE 5038 5060

# Запустите Asterisk
CMD ["asterisk", "-f"]
