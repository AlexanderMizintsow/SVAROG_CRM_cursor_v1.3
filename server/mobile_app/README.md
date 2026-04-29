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
- Для ветки рекламаций примените миграцию `sql/mobile_complaints_migration.sql`.

## Текущие маршруты
- `GET /health` — проверка сервиса и БД.
- `POST /api/mobile/auth/login` — вход по `companyName + password`.
- `POST /api/mobile/auth/refresh` — обновление access/refresh токенов (ротация).
- `POST /api/mobile/auth/logout` — отзыв текущей refresh-сессии.
- `GET /api/mobile/complaints/list` — список поданных рекламаций (`V6R`).
- `GET /api/mobile/complaints/ticket/:requestNumber` — детали рекламации.
- `POST /api/mobile/complaints/quick` — быстрая рекламация.
- `POST /api/mobile/complaints/draft/start` — старт структурированной рекламации.
- `GET /api/mobile/complaints/order-items` — получение изделий из AW.
- `POST /api/mobile/complaints/draft/:id/items` — добавить item/part/reason.
- `POST /api/mobile/complaints/draft/:id/attachments` — вложение в черновик.
- `POST /api/mobile/complaints/draft/:id/submit` — финальная отправка черновика.
- `GET /api/mobile/complaints/ratings/pending` — закрытые рекламации на оценку.
- `POST /api/mobile/complaints/:requestNumber/rating` — оценка с отправкой в 1С (`V0N...Q...`).
- `POST /api/mobile/complaints/:requestNumber/rating-comment` — обновление комментария к оценке.
