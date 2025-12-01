# Инструкция по настройке компонента "Автоматизация маркетинга"

## Шаги для запуска

### 1. Создание таблиц в базе данных

**ВАЖНО:** Перед использованием компонента необходимо выполнить SQL-скрипт для создания таблиц:

```bash
# Подключитесь к вашей PostgreSQL базе данных и выполните:
psql -U ваш_пользователь -d ваша_база_данных -f db/auto.sql
```

Или выполните содержимое файла `db/auto.sql` через любой клиент PostgreSQL (pgAdmin, DBeaver и т.д.)

### 2. Запуск сервера telegram_dealer_bot

Убедитесь, что сервер запущен на порту 5778:

```bash
cd server/telegram_dealer_bot
node index.js
```

Или если используете PM2:
```bash
pm2 start server/telegram_dealer_bot/index.js --name telegram_dealer_bot-server
```

### 3. Проверка работы

После запуска сервера проверьте в консоли:
- Должно появиться сообщение: `Сервер запущен на http://localhost:5778`
- Должно появиться: `[MARKETING] Контроллер маркетинга загружен успешно`
- Должно появиться: `[CRON][INIT] Инициализация планировщика автоматической отправки маркетинга...`

### 4. Проверка в браузере

Откройте в браузере:
- `http://localhost:5778/api/marketing/categories` - должен вернуть пустой массив `[]` или список категорий

### 5. Если возникают ошибки

**Ошибка: ERR_CONNECTION_REFUSED**
- Убедитесь, что сервер запущен
- Проверьте, что порт 5778 не занят другим процессом
- Проверьте логи сервера на наличие ошибок

**Ошибка: relation "marketing_categories" does not exist**
- Выполните SQL-скрипт `db/auto.sql` в базе данных

**Ошибка: Контроллер не загружен**
- Проверьте логи сервера на наличие ошибок при загрузке модуля
- Убедитесь, что файл `server/telegram_dealer_bot/controllers/marketingController.js` существует

## Структура файлов

- `db/auto.sql` - структура базы данных
- `client/src/routes/adminMenu/marketingAutomation/` - клиентская часть
- `server/telegram_dealer_bot/controllers/marketingController.js` - API endpoints
- `server/telegram_dealer_bot/queryLines/marketingInfo/marketingInfo.js` - обработчик команд бота
- `server/telegram_dealer_bot/helpers/marketingCron.js` - CRON-задача

## Порты

- Клиент: `http://localhost:5173`
- Сервер маркетинга: `http://localhost:5778`
- Другие серверы: `5000`, `5003` и т.д.

