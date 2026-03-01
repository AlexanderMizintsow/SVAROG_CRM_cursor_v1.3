Что менять при переносе на другой ПК
Обязательно (адреса и CORS)
Где	Файл	Что менять
Register	server/register/.env	Раскомментировать и задать BPE_API_URL, CORS_ORIGINS
Email-service	server/email-service/.env	Раскомментировать CORS_ORIGINS, REGISTER_URL
BPE	server/business_process_engine/.env	REGISTER_API_URL=http://IP:5000, при необходимости TG_BOT_API_URL=http://IP:5777
Фронт	client/.env	REACT_APP_AUTH=http://IP:5000
Telegram dealer bot	server/telegram_dealer_bot/config.js	В коде переключить API_BASE_URL на http://IP: или вынести в .env










# Чек-лист: что менять в .env и config при переносе на другой ПК

При деплое на другой компьютер замените `localhost` и IP на актуальные. Ниже — все места, где задаются адреса.

---

## 1. Register (основной API, порт 5000)

**Файл:** `server/register/.env`

| Переменная | Что задаёт | Пример на другом ПК |
|------------|------------|----------------------|
| `BPE_API_URL` | Адрес движка бизнес-процессов (webhooks) | `http://192.168.57.112:5010` |
| `CORS_ORIGINS` | Разрешённые origin для CORS и Socket.io (через запятую) | `http://192.168.57.112:5173,http://localhost:5173` |
| `DB_HOST` | Хост PostgreSQL (если БД на другом сервере) | `192.168.57.x` или `localhost` |

Конфиг: `server/register/config.js` — читает только из .env, в коде ничего менять не нужно.

---

## 2. Email-service (порт из .env или по умолчанию)

**Файл:** `server/email-service/.env`

| Переменная | Что задаёт | Пример на другом ПК |
|------------|------------|----------------------|
| `CORS_ORIGINS` | Origin для CORS и Socket.io (через запятую) | `http://192.168.57.112:5173,http://localhost:5173` |
| `REGISTER_URL` | Адрес Register-сервера | `http://192.168.57.112:5000` |
| `DB_HOST` | Хост PostgreSQL | при необходимости |

Конфиг: `server/email-service/config.js` — читает CORS из .env.

---

## 3. Движок бизнес-процессов (BPE, порт 5010)

**Файл:** `server/business_process_engine/.env`

| Переменная | Что задаёт | Пример на другом ПК |
|------------|------------|----------------------|
| `REGISTER_API_URL` | Адрес Register (BPE ходит туда за задачами/проектами) | `http://192.168.57.112:5000` |
| `TG_BOT_API_URL` | Адрес tg-bot-server (если используется) | `http://192.168.57.112:5777` |
| `DB_HOST` | Хост PostgreSQL | при необходимости |

Конфиг: `server/business_process_engine/config.js` — всё из .env.

---

## 4. tg-bot-server (порт 5777)

**Файл:** `server/tg-bot-server/.env`

| Переменная | Что задаёт | Пример на другом ПК |
|------------|------------|----------------------|
| `DB_HOST` | Хост PostgreSQL | при необходимости |

**Код:** `server/tg-bot-server/index.js` — CORS origin захардкожен (`localhost:5173`, `192.168.57.112:5173`). Для гибкости лучше вынести в .env (CORS_ORIGINS), как в register.

---

## 5. CRM-server (порт 5004)

**Файл:** `server/CRM-server/.env`

| Переменная | Что задаёт | Пример на другом ПК |
|------------|------------|----------------------|
| `DB_HOST` | Хост PostgreSQL | при необходимости |

**Код:** `server/CRM-server/index.js` — CORS origin захардкожен. Для другого ПК нужно либо добавить CORS_ORIGINS в .env и config, либо править массив в коде.

---

## 6. Telegram dealer bot

**Файл:** `server/telegram_dealer_bot/.env`

| Переменная | Что задаёт | Пример на другом ПК |
|------------|------------|----------------------|
| `SERVER_IP` | IP сервера (уже 192.168.57.77) | при другом хосте — свой IP |
| `DB_HOST` | Хост PostgreSQL | при необходимости |

**Файл:** `server/telegram_dealer_bot/config.js` — **здесь вручную переключается базовый URL API:**
- `API_BASE_URL: 'http://localhost:'` — локальная разработка;
- `API_BASE_URL: 'http://192.168.57.112:'` — другой ПК.

Рекомендуется вынести в .env, например `API_BASE_URL=http://192.168.57.112` и читать в config.js из process.env.

**Код:** `server/telegram_dealer_bot/index.js` — CORS origin захардкожен (localhost:5173, 192.168.57.112:5173). При другом ПК — добавить свой origin в массив или через .env.

В `helpers/api.js` и `queryLines/orders1c/orders1c.js` захардкожен IP `192.168.57.77` (1C/сокеты) — менять при другом окружении 1C.

---

## 7. Клиент (фронт, Vite обычно 5173)

**Файл:** `client/.env`

| Переменная | Что задаёт | Пример на другом ПК |
|------------|------------|----------------------|
| `REACT_APP_AUTH` | URL Register (API) | `http://192.168.57.112:5000` |

Без этого фронт будет ходить на localhost:5000.

---

## 8. Остальные сервисы (AW, dealer-server, asterisk_server)

- **server/AW/.env** — `DB_HOST` (у вас уже 192.168.57.3 для БД).
- **server/dealer-server/.env** — в основном DB_*, адреса не просматривались.
- **server/asterisk_server/.env** — `AMI_HOST=192.168.57.165` (IP Asterisk). Менять при другом сервере Asterisk.
- **server/asterisk_server/Asterisk.js** — захардкожены `amiHost`, `io("http://127.0.0.1:5004")`. При переносе — вынести в .env.

---

## Краткая сводка: минимум для «другого ПК»

1. **server/register/.env** — раскомментировать и задать `BPE_API_URL`, `CORS_ORIGINS`.
2. **server/email-service/.env** — раскомментировать `CORS_ORIGINS`, `REGISTER_URL`.
3. **server/business_process_engine/.env** — заменить `REGISTER_API_URL` (и при необходимости `TG_BOT_API_URL`) на IP этого ПК.
4. **client/.env** — заменить `REACT_APP_AUTH` на `http://IP_ЭТОГО_ПК:5000`.
5. **server/telegram_dealer_bot/config.js** — переключить `API_BASE_URL` на `http://IP_ПК:` или вынести в .env.

Остальное (DB_HOST, AMI_HOST, SERVER_IP и т.д.) — по мере того, где у вас БД, Asterisk и 1C на другом ПК/сети.
