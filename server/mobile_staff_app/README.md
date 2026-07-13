# mobile_staff_app server

Отдельный сервер для мобильного приложения **ПОЗ-сотрудники**.

Слушает порт **5011** — тот же, что раньше использовал `mobile_app` для дилеров.
Caddy, домен `api.mobiletest2026m.ru:8443` и NAT **менять не нужно**.

## Быстрый старт

1. Применить миграцию: `sql/mobile_staff_security_migration.sql`
2. Скопировать `.env.example` в `.env` и задать JWT-секреты
3. `npm install`
4. `npm run dev`

## Маршруты

- `GET /health`
- `POST /api/mobile/employee/auth/login`
- `POST /api/mobile/employee/auth/refresh`
- `POST /api/mobile/employee/auth/logout`
- `POST /api/mobile/auth/*` — алиас тех же маршрутов

## Пароли сотрудников

Выдаются из CRM: вкладка «Пароли для мобильного приложения сотрудников»
(`PUT /api/users/mobile-staff-password/:id` на register-сервере).

Поле в БД: `users.mobile_staff_password` (bcrypt, `NOTACCES` = доступ закрыт).

## Дилерское приложение

`server/mobile_app` временно не запускается. При возврате дилеров —
отдельный домен/порт и перенастройка Caddy.
