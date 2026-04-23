# mobile_app server

## Назначение
Отдельный сервер для мобильного приложения ПОЗ.

## Быстрый старт
1. Скопировать `.env.example` в `.env`.
2. Заполнить переменные окружения.
3. Установить зависимости: `npm install`.
4. Запустить: `npm run dev` или `npm start`.

## Важные требования безопасности
- Укажите реальные длинные значения для `JWT_ACCESS_SECRET` и `JWT_REFRESH_SECRET`.
- Не оставляйте шаблонные значения из `.env.example`.
- Для production обязательно выставить корректный `CORS_ORIGIN` (не `*`).
- Для существующей БД примените миграцию `sql/mobile_app_security_migration.sql`.

## Текущие маршруты
- `GET /health` — проверка сервиса и БД.
- `POST /api/mobile/auth/login` — вход по `companyName + password`.
- `POST /api/mobile/auth/refresh` — обновление access/refresh токенов (ротация).
- `POST /api/mobile/auth/logout` — отзыв текущей refresh-сессии.
