# Движок бизнес-процессов SVAROG CRM — Полная спецификация (сервер + клиент)

## Часть A. Архитектура и решение по серверу

### A.1 Нужен ли отдельный сервер

**Да.** Отдельный сервис `business_process_engine` целесообразен по следующим причинам:

1. **Разделение ответственности (SRP)**  
   Движок процессов — отдельная доменная область: определения процессов, экземпляры, исполнение по графу узлов, таймеры, интеграции. Вынос в отдельный сервис не перегружает register и упрощает развитие.

2. **Масштабируемость**  
   Воркеры таймеров и тяжёлые процессы можно масштабировать независимо от основного API (register).

3. **Соответствие текущей архитектуре проекта**  
   В проекте уже есть отдельные сервисы: `register` (порт 5000), `dealer-server` (5003), `email-service` (5001), `tg-bot-server`. Добавление `business_process_engine` на отдельном порту (например, 5004) укладывается в ту же модель.

4. **Единая БД**  
   Сервис подключается к той же PostgreSQL (SVAROG_DB), создаёт и использует только свои таблицы; пользователи, задачи, напоминания остаются в существующих таблицах. Внешние действия (создание задач, уведомления) выполняются через HTTP-вызовы к register (и при необходимости к tg-bot-server) или через общую БД там, где это оправдано (например, чтение users/departments).

**Итог:** папка сервера — `server/business_process_engine`, отдельный Node.js (Express) сервис, свой порт (рекомендуется 5004).

---

### A.2 Принципы построения (BPM-подход)

Опираемся на общепринятые практики BPM/BPMN в упрощённом виде, адаптированном под ваше приложение:

1. **Разделение определения и исполнения**  
   **Process Definition** (схема процесса) хранится отдельно от **Process Instance** (конкретный запуск). Одна схема может порождать много экземпляров.

2. **Граф узлов и рёбер**  
   Процесс — ориентированный граф: узлы (блоки) и направленные рёбра (стрелки). Исполнение идёт от узла к узлу по рёбрам; у развилок выбор ребра по условию.

3. **Контекст экземпляра**  
   У каждого экземпляра есть контекст (переменные): инициатор, последняя созданная задача, выходы блоков (task_id и т.д.). Следующие узлы читают контекст.

4. **Идемпотентность и логирование**  
   Критичные действия (создание задачи, переход) логируются; при сбоях можно восстанавливать состояние из лога.

5. **Интеграция через контракты**  
   Движок не дублирует логику задач/пользователей, а вызывает существующие API register по HTTP (создание задачи, получение пользователей и т.д.).

---

## Часть B. База данных (таблицы)

Все таблицы создаются в той же БД SVAROG_DB. Миграции можно оформить одним файлом, например `server/business_process_engine/db/migrations/001_initial.sql`, и выполнять при старте или отдельной командой.

### B.1 Таблицы движка бизнес-процессов

#### 1. `bp_process_definitions` (определения процессов)

Хранит схемы процессов (название, описание, черновик/опубликован, граф узлов и рёбер в JSON).

| Колонка | Тип | Ограничения | Описание |
|--------|-----|-------------|----------|
| id | SERIAL | PRIMARY KEY | Идентификатор |
| name | VARCHAR(255) | NOT NULL | Название процесса |
| description | TEXT | | Описание (для списка и подсказок) |
| scheme | JSONB | NOT NULL | Граф: `{ "nodes": [...], "edges": [...] }` (см. ниже) |
| is_draft | BOOLEAN | DEFAULT true | true — черновик (нельзя запустить), false — готов к запуску |
| version | INT | DEFAULT 1 | Версия определения (при сохранении новой схемы можно инкрементировать) |
| created_at | TIMESTAMP | DEFAULT NOW() | Дата создания |
| updated_at | TIMESTAMP | DEFAULT NOW() | Дата последнего обновления |
| created_by | INT | REFERENCES users(id) ON DELETE SET NULL | Автор определения |

**Структура `scheme`:**
```json
{
  "nodes": [
    {
      "id": "node_uuid_1",
      "type": "start",
      "position": { "x": 100, "y": 100 },
      "label": "Старт",
      "settings": { "initiatorType": "current_user" }
    },
    {
      "id": "node_uuid_2",
      "type": "create_task",
      "position": { "x": 300, "y": 100 },
      "label": "Создать задачу",
      "settings": { "templateId": 1, "assigneeSource": "users", "assigneeUserIds": [2, 3], ... }
    }
  ],
  "edges": [
    { "id": "edge_1", "source": "node_uuid_1", "target": "node_uuid_2" },
    { "id": "edge_2", "source": "node_uuid_2", "target": "node_uuid_3", "condition": "task_completed" }
  ]
}
```

Индексы: `idx_bp_process_definitions_is_draft`, `idx_bp_process_definitions_created_by`.

---

#### 2. `bp_process_instances` (экземпляры процессов)

Один запуск процесса: ссылка на определение, текущий узел, статус, контекст.

| Колонка | Тип | Ограничения | Описание |
|--------|-----|-------------|----------|
| id | SERIAL | PRIMARY KEY | Идентификатор экземпляра |
| process_id | INT | NOT NULL, REFERENCES bp_process_definitions(id) ON DELETE CASCADE | Какое определение запущено |
| started_at | TIMESTAMP | DEFAULT NOW() | Время старта |
| finished_at | TIMESTAMP | | Время завершения (NULL пока не завершён) |
| initiator_id | INT | REFERENCES users(id) ON DELETE SET NULL | Инициатор (кто запустил или выбран в блоке Старт) |
| launched_by_user_id | INT | REFERENCES users(id) ON DELETE SET NULL | Кто нажал «Запустить» (может отличаться от initiator_id) |
| current_node_id | VARCHAR(100) | | id узла в scheme, на котором сейчас экземпляр |
| status | VARCHAR(30) | NOT NULL, CHECK (status IN ('running', 'waiting_gateway', 'waiting_timer', 'completed', 'failed', 'cancelled')) | Текущий статус |
| context | JSONB | DEFAULT '{}' | Переменные: `last_task_id`, `block_outputs`, `timer_until` и т.д. |
| error_message | TEXT | | Сообщение об ошибке при status = 'failed' |

- `running` — движок выполняет автоматические шаги.
- `waiting_gateway` — ожидание события (например, смена статуса задачи) для развилки.
- `waiting_timer` — ожидание таймера; воркер по расписанию переведёт дальше.
- `completed` / `failed` / `cancelled` — конечные состояния.

Индексы: `idx_bp_process_instances_process_id`, `idx_bp_process_instances_status`, `idx_bp_process_instances_initiator_id`, `idx_bp_process_instances_started_at`, `idx_bp_process_instances_waiting_timer` (WHERE status = 'waiting_timer').

---

#### 3. `bp_node_execution_log` (лог прохода по узлам)

Для аналитики и отладки: когда экземпляр вошёл в узел и вышел из него.

| Колонка | Тип | Ограничения | Описание |
|--------|-----|-------------|----------|
| id | SERIAL | PRIMARY KEY | |
| instance_id | INT | NOT NULL, REFERENCES bp_process_instances(id) ON DELETE CASCADE | Экземпляр |
| node_id | VARCHAR(100) | NOT NULL | id узла в scheme |
| entered_at | TIMESTAMP | DEFAULT NOW() | Вход в узел |
| exited_at | TIMESTAMP | | Выход (NULL если ещё в узле или процесс упал) |
| outcome | VARCHAR(30) | CHECK (outcome IN ('success', 'condition_met', 'error', 'timer_scheduled')) | Результат прохода |
| payload | JSONB | | Доп. данные (например, созданный task_id, выбранная ветка) |

Индексы: `idx_bp_node_execution_log_instance_id`, `idx_bp_node_execution_log_node_id`, `idx_bp_node_execution_log_entered_at`.

---

#### 4. `bp_task_process_links` (связь задач Менеджера задач с процессами)

Чтобы при смене статуса задачи в register движок мог найти экземпляры, ожидающие в развилке по этой задаче.

| Колонка | Тип | Ограничения | Описание |
|--------|-----|-------------|----------|
| id | SERIAL | PRIMARY KEY | |
| task_id | INT | NOT NULL | ID задачи в таблице tasks (register) |
| process_instance_id | INT | NOT NULL, REFERENCES bp_process_instances(id) ON DELETE CASCADE | Экземпляр процесса |
| node_id | VARCHAR(100) | NOT NULL | Узел, создавший или «наблюдающий» задачу (для развилки) |
| created_at | TIMESTAMP | DEFAULT NOW() | |

Уникальность: одна задача может быть связана с одним экземпляром и одним узлом (создатель). Для развилок движок ищет экземпляры по `task_id` в этой таблице (и по `current_node_id` = развилка, привязанная к этой задаче).

Индексы: `idx_bp_task_process_links_task_id`, `idx_bp_task_process_links_instance_id`.

---

#### 5. `bp_timer_waiting` (ожидание таймера)

Экземпляры в статусе `waiting_timer` дублируются здесь для быстрого обхода воркером (без разбора JSON context).

| Колонка | Тип | Ограничения | Описание |
|--------|-----|-------------|----------|
| id | SERIAL | PRIMARY KEY | |
| instance_id | INT | NOT NULL, UNIQUE, REFERENCES bp_process_instances(id) ON DELETE CASCADE | Экземпляр |
| node_id | VARCHAR(100) | NOT NULL | Узел «Таймер» |
| resume_at | TIMESTAMP | NOT NULL | Когда перевести процесс дальше |
| created_at | TIMESTAMP | DEFAULT NOW() | |

Индекс: `idx_bp_timer_waiting_resume_at` (для выборки по resume_at <= NOW()).

---

#### 6. `bp_gateway_waiting` (ожидание развилки по задаче)

Экземпляры в статусе `waiting_gateway`: движок ждёт изменения задачи (выполнена/просрочена и т.д.), чтобы выбрать следующую ветку.

| Колонка | Тип | Ограничения | Описание |
|--------|-----|-------------|----------|
| id | SERIAL | PRIMARY KEY | |
| instance_id | INT | NOT NULL, REFERENCES bp_process_instances(id) ON DELETE CASCADE | Экземпляр |
| node_id | VARCHAR(100) | NOT NULL | Узел «Развилка» |
| task_id | INT | NOT NULL | Задача, по которой проверяется условие |
| created_at | TIMESTAMP | DEFAULT NOW() | |

Индексы: `idx_bp_gateway_waiting_task_id`, `idx_bp_gateway_waiting_instance_id`.

---

### B.2 Шаблоны задач (для блока «Создать задачу»)

Шаблоны можно хранить в движке (чтобы не трогать register), либо в register — по вашему выбору. Ниже — вариант в движке.

#### 7. `bp_task_templates` (шаблоны задач)

| Колонка | Тип | Ограничения | Описание |
|--------|-----|-------------|----------|
| id | SERIAL | PRIMARY KEY | |
| name | VARCHAR(255) | NOT NULL | Название шаблона |
| description | TEXT | | Описание по умолчанию (HTML/текст, как в AddModal) |
| priority_default | VARCHAR(20) | DEFAULT 'низкий' | низкий | средний | высокий |
| tags_default | JSONB | DEFAULT '[]' | Массив тегов по умолчанию |
| deadline_offset_days | INT | | Смещение дедлайна от момента создания (например, 3 = +3 дня); NULL — без дедлайна по умолчанию |
| is_active | BOOLEAN | DEFAULT true | Показывать в выборе |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | DEFAULT NOW() | |
| created_by | INT | REFERENCES users(id) ON DELETE SET NULL | |

Индекс: `idx_bp_task_templates_is_active`.

---

### B.3 Связь с существующей таблицей `tasks`

В таблицу `tasks` (в register/db) **рекомендуется добавить** опциональное поле:

- `business_process_instance_id INT NULL REFERENCES bp_process_instances(id) ON DELETE SET NULL`

Либо обходиться только таблицей `bp_task_process_links` без изменения схемы register: связь «задача ↔ процесс» хранится в BPE. Тогда при создании задачи через API register поле не передаётся; движок после создания задачи записывает связь в `bp_task_process_links`. Если позже решите писать instance_id в саму задачу (для отображения в карточке задачи) — можно добавить колонку в миграции register.

---

## Часть C. Серверная часть (business_process_engine)

### C.1 Структура папок

```
server/business_process_engine/
├── .env
├── package.json
├── Dockerfile
├── index.js
├── config.js
├── db/
│   ├── pool.js
│   └── migrations/
│       └── 001_initial.sql
├── routes/
│   ├── processDefinitions.js
│   ├── processInstances.js
│   ├── taskTemplates.js
│   └── analytics.js
├── controllers/
│   ├── processDefinitionsController.js
│   ├── processInstancesController.js
│   ├── taskTemplatesController.js
│   └── analyticsController.js
├── engine/
│   ├── runner.js
│   ├── nodeHandlers/
│   │   ├── index.js
│   │   ├── start.js
│   │   ├── end.js
│   │   ├── createTask.js
│   │   ├── assignTask.js
│   │   ├── notification.js
│   │   ├── gateway.js
│   │   └── timer.js
│   ├── integrations/
│   │   ├── registerClient.js
│   │   └── telegramClient.js
│   └── workers/
│       └── timerWorker.js
├── middleware/
│   └── auth.js
└── utils/
    └── schemeValidator.js
```

### C.2 Конфигурация (.env)

- `PORT=5004`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` — та же БД SVAROG_DB.
- `REGISTER_API_URL=http://register-service:5000` (или `http://localhost:5000` локально) — для вызовов создания задач, пользователей, отделов, ролей, напоминаний.
- `TG_BOT_API_URL=http://tg-bot-server:5777` (или `http://localhost:5777` локально) — базовый URL tg-bot-server для вызова эндпоинта отправки сообщений в Telegram (см. ниже). В tg-bot-server добавить `POST /api/bpe/send-message` с телом `{ user_ids: number[], message: string }`: для каждого user_id получить chat_id из telegramm_registrations_chat и вызвать bot.sendMessage(chat_id, message). Логика аналогична sendGroupCreationNotification (получение chat_id по user_id).

### C.3 API (REST)

Базовый префикс: `/api/bp` (business process).

**Определения процессов**

- `GET /api/bp/processes` — список определений (фильтр: is_draft true/false, created_by).
- `GET /api/bp/processes/:id` — одно определение (схема).
- `POST /api/bp/processes` — создание (body: name, description, scheme, is_draft).
- `PUT /api/bp/processes/:id` — обновление (name, description, scheme, is_draft).
- `DELETE /api/bp/processes/:id` — удаление (если нет запущенных экземпляров или только завершённые).

**Экземпляры**

- `POST /api/bp/processes/:id/start` — запуск процесса (body: initiator_id опционально; если не передан, из схемы Старта или launched_by_user_id из тела запроса).
- `GET /api/bp/instances` — список экземпляров (фильтр: process_id, initiator_id, status, даты).
- `GET /api/bp/instances/:id` — один экземпляр (состояние, контекст, текущий узел).
- `POST /api/bp/instances/:id/cancel` — отмена (status → cancelled).

**Шаблоны задач**

- `GET /api/bp/task-templates` — список активных шаблонов.
- `POST /api/bp/task-templates` — создание шаблона.
- `PUT /api/bp/task-templates/:id` — обновление.
- `DELETE /api/bp/task-templates/:id` — удаление (или is_active = false).

**Справочники для конструктора (прокси к register)**

- `GET /api/bp/references/users` — прокси к register `/api/users` (чтобы клиент мог ходить только на BPE при построении схемы).
- `GET /api/bp/references/departments` — прокси к `/api/departments`.
- `GET /api/bp/references/roles` — прокси к `/api/roles`.

**Аналитика (первая версия)**

- `GET /api/bp/analytics/process/:processId` — сводка по процессу: количество запусков, завершённых, средняя длительность, время по узлам (из bp_node_execution_log).

### C.4 Движок исполнения (engine/runner.js)

- При `POST .../start` создаётся запись в `bp_process_instances` (status = running, current_node_id = id узла типа start из scheme).
- В лог пишется вход в узел Старт.
- Далее цикл (синхронно или очередь):
  - Взять current_node_id, тип узла из scheme.
  - Вызвать соответствующий обработчик из `engine/nodeHandlers/`.
  - Обработчик возвращает: `{ nextNodeId }` или `{ waitGateway: { taskId } }` или `{ waitTimer: { resumeAt } }` или `{ end }` / `{ fail: message }`.
  - При nextNodeId: обновить current_node_id, записать в лог выход из текущего и вход в следующий; если следующий узел — снова действие (create_task, notification и т.д.), выполнить его в том же цикле, пока не упрёмся в развилку/таймер/конец.
  - При waitGateway: записать в bp_gateway_waiting, status = waiting_gateway, выйти (продолжение по вебхуку/событию от register).
  - При waitTimer: записать в bp_timer_waiting и bp_process_instances.context, status = waiting_timer, выйти; продолжение в timerWorker.
  - При end/fail: обновить status, finished_at, выйти.

### C.5 Обработчики узлов (nodeHandlers)

- **start** — инициализация context (initiator_id из настроек или переданный при старте). nextNodeId = единственное исходящее ребро.
- **end** — завершение (completed). nextNodeId нет.
- **create_task** — через registerClient: POST /api/tasks/create, затем assignment/add, approval/add, visibility/add; запись в bp_task_process_links; в context block_outputs[node_id] = { task_id }, last_task_id = task_id. nextNodeId = следующее ребро.
- **assign_task** — взять task_id из context (по node_id из настроек); через registerClient assignment/add или replace. nextNodeId = следующее ребро.
- **notification** — разрешить получателей (users/departments/roles/initiator/executor of task X) через register; создать reminder в БД (если in-app) и/или вызвать Telegram API; подстановки в тексте из context. nextNodeId = следующее ребро.
- **gateway** — прочитать из настроек, к какой задаче привязана развилка (task_id из context). Если условие уже можно вычислить (задача выполнена/просрочена) — вернуть nextNodeId по соответствующему ребру (condition). Иначе — вернуть waitGateway(taskId), записать в bp_gateway_waiting.
- **timer** — вычислить resume_at из настроек (интервал или дата); вернуть waitTimer(resumeAt).

Обработчики получают: (instance, node, scheme, registerClient, dbPool). Все обращения к БД и внешним API — через эти зависимости.

### C.6 Интеграция с register и tg-bot-server

- **registerClient** (axios): вызовы POST /api/tasks/create (с полем business_process_instance_id в теле), POST /api/tasks/assignment/add, GET /api/tasks/:id, GET /api/users, GET /api/departments, GET /api/roles. В register: при createTask принимать business_process_instance_id (опционально) и записывать в tasks; при создании подзадачи (parent_id передан) — брать business_process_instance_id у родительской задачи и подставлять в новую запись, чтобы подзадачи тоже отображались как часть процесса.
- **Вебхук «задача обновлена»:** в register после успешного updateTaskStatus и updateTaskAccept вызывать BPE: `POST {BPE_URL}/api/bp/webhooks/task-updated` с телом `{ task_id }`. BPE по bp_task_process_links и bp_gateway_waiting находит экземпляры в статусе waiting_gateway по этой задаче, пересчитывает условие развилки (выполнена / просрочена и т.д.), обновляет current_node_id и context, ставит status = running и снова запускает цикл runner. Без этого вебхука процессы с развилками «ждать выполнения задачи» не смогут автоматически продолжиться.
- **tg-bot-server:** при выполнении блока «Уведомление» с каналом «Telegram» BPE вызывает `POST {TG_BOT_API_URL}/api/bpe/send-message` с телом `{ user_ids: number[], message: string }`. В tg-bot-server этот эндпоинт реализовать: для каждого user_id получить chat_id из telegramm_registrations_chat и отправить сообщение через bot.sendMessage(chat_id, message) — по аналогии с существующей логикой отправки (sendGroupCreationNotification и т.п.).

### C.7 Воркер таймеров (timerWorker.js)

- По расписанию (cron, например каждую минуту) выборка из bp_timer_waiting где resume_at <= NOW().
- Для каждой записи: обновить instance (current_node_id = следующий узел по ребру от таймера, status = running), удалить запись из bp_timer_waiting, дописать лог, вызвать runner для следующего узла.

### C.8 Авторизация и права на создание процессов

- **Проверка токена:** не используется. Приложение работает во внутренней сети, запросы к BPE не защищаются JWT. При необходимости позже можно включить middleware проверки токена без изменения контрактов API.
- **Права на создание/редактирование определений:** на данный момент любой пользователь может создавать, обновлять и удалять определения процессов. Код оформить так, чтобы позже можно было вставить проверку по ролям или по списку id пользователей без переписывания логики: вынести в конфиг (например, config.js или .env) параметры `ALLOWED_PROCESS_DESIGNER_ROLE_IDS` и/или `ALLOWED_PROCESS_DESIGNER_USER_IDS` (массивы). В начале маршрутов POST/PUT/DELETE для определений процессов (или в отдельном middleware) проверять: если массив не задан или пуст — разрешать всем; иначе — проверять роль или id текущего пользователя (если клиент будет передавать user_id в заголовке или теле запроса). Так вы сможете позже ограничить круг лиц, заполнив конфиг.

---

## Часть D. Клиентская часть

### D.1 Маршрутизация и меню

- В `client/src/config/routes.jsx` добавить маршрут, например `/business-processes`, элемент — контейнер «Бизнес-процессы» с двумя вкладками.
- В `client/src/components/navbar/NavBar.jsx` (или Menu) добавить пункт «Бизнес-процессы» с иконкой (например, FcFlowChart или аналог), ссылка `/business-processes`. Размещение — рядом с «Менеджер задач» или в блоке CRM, по вашему усмотрению.
- В `client/config.js` (или аналог) завести базовый URL для BPE: `BPE_API_BASE_URL = 'http://localhost:5004'` (в проде — соответствующий хост/порт или прокси через nginx).

### D.2 Структура компонентов (клиент)

```
client/src/
├── routes/
│   └── businessProcesses/
│       ├── BusinessProcesses.jsx
│       ├── businessProcesses.scss
│       ├── ProcessList/
│       │   ├── ProcessList.jsx
│       │   ├── ProcessList.scss
│       │   └── ProcessCard.jsx
│       ├── ProcessDesigner/
│       │   ├── ProcessDesigner.jsx
│       │   ├── ProcessDesigner.scss
│       │   ├── Palette/
│       │   │   ├── Palette.jsx
│       │   │   └── Palette.scss
│       │   ├── Canvas/
│       │   │   ├── FlowCanvas.jsx
│       │   │   └── FlowCanvas.scss
│       │   └── PropertiesPanel/
│       │       ├── PropertiesPanel.jsx
│       │       ├── PropertiesPanel.scss
│       │       ├── StartNodeProps.jsx
│       │       ├── EndNodeProps.jsx
│       │       ├── CreateTaskNodeProps.jsx
│       │       ├── AssignTaskNodeProps.jsx
│       │       ├── NotificationNodeProps.jsx
│       │       ├── GatewayNodeProps.jsx
│       │       └── TimerNodeProps.jsx
│       └── InstanceList/
│           ├── InstanceList.jsx
│           └── InstanceCard.jsx
├── store/
│   └── useBusinessProcessStore.js
└── api/
    └── businessProcessApi.js
```

### D.3 Экраны и сценарии

1. **Бизнес-процессы (контейнер)**  
   Две вкладки: «Готовые процессы» | «Конструктор». По умолчанию — «Готовые процессы».

2. **Вкладка «Готовые процессы»**  
   - Список из `GET /api/bp/processes?is_draft=false`. Карточка: название, описание, кнопка «Запустить».
   - По «Запустить» — модальное окно: выбор инициатора (если в схеме Старт разрешён выбор) или сразу отправка `POST /api/bp/processes/:id/start`. Показать успех и ссылку/переход к «Мои запуски» или к экземпляру.
   - Опционально: третья подвкладка «Мои запуски» — список экземпляров `GET /api/bp/instances?initiator_id=currentUser` с фильтром по статусу.

3. **Вкладка «Конструктор»**  
   - Слева: **Палитра** — типы узлов (Старт, Конец, Создать задачу, Назначить задачу, Уведомление, Развилка, Таймер). Добавление на холст по клику или drag-and-drop (id узла генерировать на клиенте, например uuid).
   - Центр: **Холст** — граф (библиотека: React Flow или самописный SVG/Canvas). Узлы перетаскиваются, от узла к узлу рисуются связи (edges). Выбор узла подсвечивает его и открывает панель свойств справа.
   - Справа: **Панель свойств** — в зависимости от типа узла показывается форма (StartNodeProps, CreateTaskNodeProps и т.д.). Данные сохраняются в состоянии схемы (nodes[].settings, edges[].condition).
   - Кнопки: «Сохранить черновик», «Опубликовать» (is_draft false), «Создать процесс» (имя, описание + схема). Валидация перед сохранением: ровно один Старт, все узлы достижимы, у развилок у каждого ребра задано условие.

4. **Панели свойств узлов (кратко)**  
   - **Старт:** инициатор — текущий пользователь / конкретный пользователь (выбор из списка users) / по роли (выбор роли).  
   - **Конец:** подпись (для аналитики), без обязательных полей.  
   - **Создать задачу:** выбор шаблона (из GET /api/bp/task-templates), переопределение названия/описания/приоритета/тегов; автор — инициатор/конкретный пользователь; исполнители/утверждающие/наблюдатели — выбор пользователей или «по отделу»/«по роли» (выпадающий список отделов/ролей); дедлайн — смещение в днях или без.  
   - **Назначить задачу:** задача — из выпадающего «задача из блока X» (список node_id блоков типа create_task/assign_task выше по графу); кому — пользователи/отдел/роль.  
   - **Уведомление:** получатели — пользователи, отдел, роль, инициатор, исполнитель задачи из блока X; каналы — in-app, Telegram (галочки); текст с подсказкой подстановок {инициатор}, {название_задачи} и т.д.; приоритет.  
   - **Развилка:** привязка к задаче — «задача из блока X»; для каждого исходящего ребра — выбор условия (выполнена, не выполнена, просрочена, в срок, ожидание одобрения, иначе).  
   - **Таймер:** тип — интервал (число + единица: минуты/часы/дни) или «до даты» (дата/время); одна исходящая стрелка.

### D.4 API-клиент (businessProcessApi.js)

- Функции-обёртки над axios: getProcesses, getProcess, createProcess, updateProcess, deleteProcess; startProcess, getInstances, getInstance, cancelInstance; getTaskTemplates, createTaskTemplate, updateTaskTemplate, deleteTaskTemplate; getReferencesUsers, getReferencesDepartments, getReferencesRoles; getAnalytics(processId). Базовый URL — BPE_API_BASE_URL. Заголовок Authorization не требуется (BPE без проверки токена).

### D.5 Стор (useBusinessProcessStore.js)

- Состояние: список процессов, выбранный процесс, схема в редакторе (nodes, edges), выбранный узел, список экземпляров. Действия: loadProcesses, loadProcess, setScheme, setSelectedNode, saveProcess, startProcess, loadInstances. По необходимости можно разделить на два стора (список/запуски и конструктор).

---

## Часть E. Инструменты (блоки) для описания бизнес-процессов — сводная таблица

| Тип узла | Описание | Настройки (ключи в settings) | Исходящие рёбра | Зависимости |
|----------|----------|------------------------------|-----------------|-------------|
| start | Точка входа | initiatorType: 'current_user' \| 'fixed_user' \| 'by_role'; fixedUserId; roleId | 1 | users, roles |
| end | Выход | label (подпись) | 0 | — |
| create_task | Создать задачу в Менеджере задач | templateId; title, description, priority, tags (переопределение); authorSource: 'initiator' \| 'fixed'; authorUserId; assigneeSource: 'users' \| 'department' \| 'role'; assigneeUserIds; departmentId; roleId; approvers, viewers (аналогично); deadlineOffsetDays | 1 | task_templates, users, departments, roles, register API |
| assign_task | Назначить задачу | sourceNodeId (узел, где создана задача); assigneeSource; assigneeUserIds; departmentId; roleId | 1 | users, departments, roles, register API |
| notification | Уведомление | recipientSource: 'users' \| 'department' \| 'role' \| 'initiator' \| 'task_assignee'; taskSourceNodeId; userIds; departmentId; roleId; channels: { inApp, telegram }; messageText; priority | 1 | users, departments, roles, reminders, TG |
| gateway | Развилка по задаче | taskSourceNodeId; edges: [{ condition: 'task_completed' \| 'task_not_completed' \| 'task_overdue' \| 'task_in_time' \| 'approval_pending' \| 'else' }] | 1..N | register GET task status |
| timer | Ожидание | type: 'interval' \| 'until_date'; intervalValue; intervalUnit: 'minutes' \| 'hours' \| 'days'; untilDate | 1 | worker |

Условия развилки: порядок проверки на сервере — сначала конкретные (task_completed, task_overdue, …), затем 'else'.

---

## Часть F. Принятые решения (ответы на уточняющие вопросы)

1. **Авторизация:** Без проверки токена. Приложение работает во внутренней сети, лишняя проверка JWT на BPE не требуется. Запросы к BPE не защищаются middleware авторизации; при необходимости позже можно включить проверку без изменения контрактов API.

2. **Telegram:** Использовать существующий tg-bot-server. В нём уже есть логика: получение `chat_id` по `user_id` из `telegramm_registrations_chat` и отправка через `bot.sendMessage(chat_id, message)` (как в `sendGroupCreationNotification`). Для BPE добавить в tg-bot-server один HTTP-эндпоинт, например `POST /api/bpe/send-message` с телом `{ user_ids: number[], message: string }`: для каждого `user_id` получить `chat_id` и отправить сообщение. BPE при выполнении блока «Уведомление» с каналом «Telegram» будет вызывать этот эндпоинт.

3. **Вебхук «задача обновлена»:** Реализовать вызов из register в BPE — так эффективнее. Когда в register меняется статус задачи (updateTaskStatus, updateTaskAccept), после успешного обновления вызывать BPE: `POST /api/bp/webhooks/task-updated` с телом `{ task_id }`. BPE по таблице `bp_gateway_waiting` и `bp_task_process_links` находит экземпляры процессов, ожидающие в развилке по этой задаче, пересчитывает условие (выполнена / просрочена и т.д.) и переводит процесс на следующую ветку. Без этого вебхука процессы с развилками «ждать выполнения задачи» не смогут автоматически продолжиться.

4. **Поле в tasks и подзадачи:** Да. В таблицу `tasks` добавить колонку `business_process_instance_id INT NULL REFERENCES bp_process_instances(id) ON DELETE SET NULL`. При создании задачи из процесса (блок «Создать задачу») передавать в register `business_process_instance_id` и сохранять в задаче. При создании подзадачи из карточки задачи, у которой уже заполнен `business_process_instance_id`, передавать тот же `business_process_instance_id` в подзадачу (в register: при INSERT в tasks, если в теле запроса передан `parent_id`, брать `business_process_instance_id` у родительской задачи и подставлять в новую запись). Так и основная задача, и все подзадачи будут отображаться как часть одного и того же бизнес-процесса.

5. **Права на создание/редактирование процессов:** На данный момент любой авторизованный пользователь может создавать и редактировать определения процессов. Код оформить так, чтобы позже можно было без переписывания логики вставить проверку по ролям или по списку id пользователей: вынести в конфиг (например, в .env или config.js) параметры вида `ALLOWED_PROCESS_DESIGNER_ROLE_IDS` или `ALLOWED_PROCESS_DESIGNER_USER_IDS`; в middleware или в начале маршрутов создания/обновления/удаления определений проверять эти значения (если массив пуст или не задан — разрешать всем, иначе проверять роль/id текущего пользователя). Так вы сможете позже включить ограничение, просто заполнив конфиг.

---

## Часть G. SQL миграции (полный скрипт)

Ниже — готовый скрипт создания таблиц движка. Выполнять в БД SVAROG_DB (после существующих таблиц users, tasks и т.д.).

```sql
-- ========== Business Process Engine: определения процессов ==========
CREATE TABLE bp_process_definitions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  scheme JSONB NOT NULL,
  is_draft BOOLEAN DEFAULT true,
  version INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by INT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_bp_process_definitions_is_draft ON bp_process_definitions(is_draft);
CREATE INDEX idx_bp_process_definitions_created_by ON bp_process_definitions(created_by);

-- ========== Экземпляры процессов ==========
CREATE TABLE bp_process_instances (
  id SERIAL PRIMARY KEY,
  process_id INT NOT NULL REFERENCES bp_process_definitions(id) ON DELETE CASCADE,
  started_at TIMESTAMP DEFAULT NOW(),
  finished_at TIMESTAMP,
  initiator_id INT REFERENCES users(id) ON DELETE SET NULL,
  launched_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  current_node_id VARCHAR(100),
  status VARCHAR(30) NOT NULL CHECK (status IN ('running', 'waiting_gateway', 'waiting_timer', 'completed', 'failed', 'cancelled')),
  context JSONB DEFAULT '{}',
  error_message TEXT
);
CREATE INDEX idx_bp_process_instances_process_id ON bp_process_instances(process_id);
CREATE INDEX idx_bp_process_instances_status ON bp_process_instances(status);
CREATE INDEX idx_bp_process_instances_initiator_id ON bp_process_instances(initiator_id);
CREATE INDEX idx_bp_process_instances_started_at ON bp_process_instances(started_at);
CREATE INDEX idx_bp_process_instances_waiting_timer ON bp_process_instances(status) WHERE status = 'waiting_timer';

-- ========== Лог прохода по узлам ==========
CREATE TABLE bp_node_execution_log (
  id SERIAL PRIMARY KEY,
  instance_id INT NOT NULL REFERENCES bp_process_instances(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,
  entered_at TIMESTAMP DEFAULT NOW(),
  exited_at TIMESTAMP,
  outcome VARCHAR(30) CHECK (outcome IN ('success', 'condition_met', 'error', 'timer_scheduled')),
  payload JSONB
);
CREATE INDEX idx_bp_node_execution_log_instance_id ON bp_node_execution_log(instance_id);
CREATE INDEX idx_bp_node_execution_log_node_id ON bp_node_execution_log(node_id);
CREATE INDEX idx_bp_node_execution_log_entered_at ON bp_node_execution_log(entered_at);

-- ========== Связь задач с процессами ==========
CREATE TABLE bp_task_process_links (
  id SERIAL PRIMARY KEY,
  task_id INT NOT NULL,
  process_instance_id INT NOT NULL REFERENCES bp_process_instances(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_bp_task_process_links_task_id ON bp_task_process_links(task_id);
CREATE INDEX idx_bp_task_process_links_instance_id ON bp_task_process_links(process_instance_id);

-- ========== Ожидание таймера ==========
CREATE TABLE bp_timer_waiting (
  id SERIAL PRIMARY KEY,
  instance_id INT NOT NULL UNIQUE REFERENCES bp_process_instances(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,
  resume_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_bp_timer_waiting_resume_at ON bp_timer_waiting(resume_at);

-- ========== Ожидание развилки по задаче ==========
CREATE TABLE bp_gateway_waiting (
  id SERIAL PRIMARY KEY,
  instance_id INT NOT NULL REFERENCES bp_process_instances(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,
  task_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_bp_gateway_waiting_task_id ON bp_gateway_waiting(task_id);
CREATE INDEX idx_bp_gateway_waiting_instance_id ON bp_gateway_waiting(instance_id);

-- ========== Шаблоны задач ==========
CREATE TABLE bp_task_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  priority_default VARCHAR(20) DEFAULT 'низкий',
  tags_default JSONB DEFAULT '[]',
  deadline_offset_days INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by INT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_bp_task_templates_is_active ON bp_task_templates(is_active);
```

**Связь задач с процессом (обязательно):** в таблице `tasks` (БД register) добавить колонку и при создании подзадачи копировать значение от родителя:

```sql
-- В БД SVAROG_DB (таблица tasks уже существует в схеме register)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS business_process_instance_id INT NULL;
ALTER TABLE tasks ADD CONSTRAINT fk_tasks_bp_instance
  FOREIGN KEY (business_process_instance_id) REFERENCES bp_process_instances(id) ON DELETE SET NULL;
CREATE INDEX idx_tasks_business_process_instance_id ON tasks(business_process_instance_id);
```

В register при создании задачи (createTask): принимать в теле запроса поле `business_process_instance_id` (опционально) и записывать в INSERT. При создании подзадачи (когда передан `parent_id`): если у родительской задачи заполнен `business_process_instance_id`, подставлять его в новую задачу (чтобы подзадачи тоже отображались как часть того же бизнес-процесса).

---

## Часть H. Варианты процессов и полнота охвата

Ниже перечислены варианты процессов, которые движок и конструктор позволяют описать и исполнять в рамках возможностей приложения SVAROG CRM. Все перечисленные сценарии реализуемы комбинацией блоков (Старт, Создать задачу, Назначить задачу, Уведомление, Развилка, Таймер, Конец).

### H.1 Варианты по инициатору (блок Старт)

| Вариант | Как задаётся | Пример использования |
|--------|----------------|----------------------|
| Инициатор = тот, кто нажал «Запустить» | initiatorType: current_user | Процесс «Заявка от сотрудника» — автор и контекст = текущий пользователь. |
| Инициатор = заранее выбранный пользователь | initiatorType: fixed_user, fixedUserId: id | Процесс «Еженедельный отчёт» — всегда от имени руководителя отдела. |
| Инициатор = любой с ролью (при запуске подставляется текущий, если подходит) | initiatorType: by_role, roleId | Ограничение запуска процесса только для роли «Руководитель отдела». |

### H.2 Варианты по созданию и назначению задач

| Вариант | Как задаётся | Пример использования |
|--------|----------------|----------------------|
| Одна задача по шаблону, исполнитель — конкретные пользователи | create_task: templateId, assigneeSource: users, assigneeUserIds | «Создать задачу по шаблону „Проверка КП“ и назначить Иванову и Петрову». |
| Исполнитель = отдел (все или руководитель) | assigneeSource: department, departmentId | «Назначить задачу отделу продаж» (логика: всем из отдела или только руководителю — в настройках блока). |
| Исполнитель = роль | assigneeSource: role, roleId | «Назначить задачу любому свободному менеджеру» (роль «Менеджер»). |
| Автор задачи = инициатор процесса или другой пользователь | authorSource: initiator | fixed | Задачи в процессе создаются от имени инициатора или, например, от руководителя. |
| Утверждающие и наблюдатели | approvers, viewers (users / department / role) | Согласование у руководителя отдела, наблюдатели — инициатор или отдел. |
| Дедлайн = смещение от создания задачи | deadlineOffsetDays: N | «Задача должна быть выполнена в течение 3 рабочих дней». |
| Несколько задач подряд разным исполнителям | Несколько блоков create_task подряд или один блок с несколькими исполнителями | Цепочка: задача 1 → после выполнения (развилка) → задача 2 следующему. |

### H.3 Варианты по уведомлениям

| Вариант | Как задаётся | Пример использования |
|--------|----------------|----------------------|
| Уведомление конкретным пользователям | notification: recipientSource: users, userIds | Напоминание исполнителю и автору. |
| Уведомление отделу или роли | recipientSource: department | role | «Уведомить всех руководителей отдела» или «всех с ролью Апрувер». |
| Уведомление инициатору процесса | recipientSource: initiator | «Инициатору: задача выполнена». |
| Уведомление исполнителю задачи из блока X | recipientSource: task_assignee, taskSourceNodeId | «Исполнителю только что созданной задачи: напоминание о дедлайне». |
| Канал: только в приложении / только Telegram / оба | channels: { inApp, telegram } | Гибкость: срочное — в приложение и TG, информационное — только в приложение. |
| Текст с подстановками | messageText с {инициатор}, {название_задачи}, {дедлайн}, {статус} | Персонализированные сообщения без ручного ввода имён. |

### H.4 Варианты по развилкам (условиям)

| Вариант | Условие на ребре | Пример использования |
|--------|-------------------|----------------------|
| Задача выполнена (подтверждена автором) | task_completed | Дальше: «Уведомить инициатора» и «Конец успех». |
| Задача не выполнена / на доработке | task_not_completed | Ветка «напоминание исполнителю» или «эскалация руководителю». |
| Срок пропущен | task_overdue | Ветка «Уведомить руководителя» или «Конец просрочка». |
| Выполнена в срок | task_in_time | Отдельная ветка для аналитики «в срок». |
| Ожидание одобрения (есть утверждающие, не все утвердили) | approval_pending | Ветка «ждать» или «напоминание утверждающим». |
| Любой другой исход (default) | else | Всегда одна ветка «прочее» на развилке. |

Комбинации: одна развилка может иметь несколько исходящих рёбер с разными условиями (выполнена / просрочена / иначе), то есть один процесс описывает несколько сценариев в зависимости от результата задачи.

### H.5 Варианты по таймеру

| Вариант | Как задаётся | Пример использования |
|--------|----------------|----------------------|
| Ожидание N минут/часов/дней | timer: type: interval, intervalValue, intervalUnit | «Через 2 дня напомнить исполнителю», «через 1 час эскалация». |
| Ожидание до даты/времени | timer: type: until_date, untilDate | «Продолжить процесс в 9:00 понедельника» или «до конца рабочего дня». |

После срабатывания таймера — один переход по стрелке (например, к блоку «Уведомление» или к следующей задаче).

### H.6 Варианты по концам процесса

| Вариант | Как задаётся | Пример использования |
|--------|----------------|----------------------|
| Один конец «Успех» | Один блок end с label «Успех» | Все ветки «задача выполнена» сходятся в один конец. |
| Несколько концов для аналитики | Несколько блоков end с разными label | «Успех», «Просрочка», «Отмена», «Эскалация» — в отчётах видно, сколько процессов завершилось по каждому исходу. |

### H.7 Типовые цепочки (примеры процессов в приложении)

- **Линейный:** Старт → Создать задачу (шаблон, исполнитель) → Уведомление (исполнителю в TG) → Конец.
- **С проверкой результата:** Старт → Создать задачу → Развилка (выполнена / просрочена / иначе) → Уведомление (инициатору / руководителю) → Конец (успех / просрочка).
- **С эскалацией по таймеру:** Старт → Создать задачу → Таймер (2 дня) → Уведомление (руководителю: «задача не выполнена») → Развилка (если всё же выполнена — успех, иначе — конец «Эскалация»). Реализация: после таймера можно снова проверить статус задачи (развилка) и развести по веткам.
- **Цепочка задач:** Старт → Создать задачу 1 (исполнитель А) → Развилка (выполнена) → Создать задачу 2 (исполнитель Б, по шаблону) → Развилка (выполнена) → Конец.
- **Согласование:** Создать задачу с утверждающими → Развилка (approval_pending / task_completed) → Уведомление утверждающим или инициатору → Конец.

### H.8 Что охвачено, чего нет в первой версии

- **Охвачено:** разные инициаторы; создание задач по шаблонам с выбором исполнителей/отдела/роли, утверждающих, наблюдателей, дедлайна; назначение существующей задачи; уведомления в приложение и в Telegram с подстановками; развилки по статусу/сроку задачи; таймеры (интервал или до даты); несколько концов для аналитики; привязка задачи и подзадач к процессу в карточке.
- **Не в первой версии (можно добавить позже):** параллельное выполнение нескольких веток (параллельный шлюз BPMN); подпроцесс (вызов другого процесса как шага); ручные задачи «ожидание решения пользователя» вне смены статуса задачи; сложные условия на развилке (несколько полей задачи одновременно).

---

## Проверка полноты (чеклист перед реализацией)

- **Сервер:** отдельный сервис business_process_engine, порт 5004, свои таблицы в SVAROG_DB; без JWT; конфиг-заглушка для прав на создание процессов (роли/id позже).
- **Таблицы:** bp_process_definitions, bp_process_instances, bp_node_execution_log, bp_task_process_links, bp_timer_waiting, bp_gateway_waiting, bp_task_templates; в tasks — business_process_instance_id; при подзадачах копировать business_process_instance_id от родителя.
- **Интеграции:** register — createTask с business_process_instance_id и копирование в подзадачи; вебхук из register в BPE при смене статуса задачи; tg-bot-server — эндпоинт POST /api/bpe/send-message для отправки по user_ids.
- **Блоки:** Старт (инициатор: текущий/фикс/роль), Конец, Создать задачу (шаблон, автор, исполнители/отдел/роль, утверждающие, наблюдатели, дедлайн), Назначить задачу, Уведомление (получатели, in-app/Telegram, подстановки), Развилка (по задаче: выполнена/просрочена/и т.д.), Таймер (интервал/до даты).
- **Варианты процессов:** разные инициаторы; разные исполнители (пользователи, отдел, роль); уведомления в приложение и/или Telegram; развилки по результату задачи (несколько исходов в одном процессе); таймеры; несколько концов для аналитики; отображение задачи и подзадач как части процесса в карточке.
- **Клиент:** две вкладки (Готовые процессы, Конструктор); палитра блоков; холст со схемой; панель свойств по типу узла; сохранение/публикация; запуск процесса; список экземпляров.
