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
- `GET/POST /api/mobile/employee/tasks` — список / создание задач
- `GET /api/mobile/employee/tasks/:id` — детали
- `PUT /api/mobile/employee/tasks/:id/status` — статус (исполнитель)
- `POST /api/mobile/employee/tasks/:id/decision` — принять / вернуть
- `GET/POST /api/mobile/employee/tasks/:id/messages` — чат
- `PATCH/DELETE /api/mobile/employee/tasks/:id/messages/:messageId` — редактирование / мягкое удаление своего сообщения
- `POST /api/mobile/employee/tasks/:id/attachments` — вложение
- `GET /api/mobile/employee/tasks/files/:filename` — прокси файла
- `GET /api/mobile/employee/tasks/extensions/pending` — запросы продления
- `GET /api/mobile/employee/tasks/:id/hierarchy` — дерево подзадач
- `GET /api/mobile/employee/tasks/:id/has-subtasks` — есть ли дети
- `GET/POST /api/mobile/employee/projects` — список / создание проектов
- `GET /api/mobile/employee/projects/:id` — детали (+ подзадачи, файлы, история)
- `PUT /api/mobile/employee/projects/:id/status` — статус (автор)
- `POST /api/mobile/employee/projects/:id/approval` — согласование
- `GET/POST /api/mobile/employee/projects/:id/messages` — чат проекта
- `POST /api/mobile/employee/projects/:id/attachments` — документы
- Socket.IO на том же порту (`/socket.io`) — задачи + `globalTaskChanged` / `newMessageGlobalTaskChat`

Нужен `REGISTER_URL` (по умолчанию `http://127.0.0.1:5000`) — шлюз к register CRM.

Для Caddy: проксируйте `/socket.io` на `5011` с websocket upgrade (если ещё не сделано для этого порта).

## Пароли сотрудников

Выдаются из CRM: вкладка «Пароли для мобильного приложения сотрудников»
(`PUT /api/users/mobile-staff-password/:id` на register-сервере).

Поле в БД: `users.mobile_staff_password` (bcrypt, `NOTACCES` = доступ закрыт).

## Дилерское приложение

`server/mobile_app` временно не запускается. При возврате дилеров —
отдельный домен/порт и перенастройка Caddy.
