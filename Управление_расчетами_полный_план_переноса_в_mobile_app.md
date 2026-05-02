# Управление расчётами: полный план переноса в мобильное приложение

Документ фиксирует раздел **`/calculations`** из `server/telegram_dealer_bot` для переноса в `apk/POZ` + `server/mobile_app`.

**Интеграция с 1С:** прямых вызовов `sendRequest1C` в этих ветках нет. Используется **AW API (порт 5005)** для подтверждения суммы заказа (`getTotalPriceOrderAW`). Сохранение заявок — **PostgreSQL** (`calculations_bot_dealers`) и **`createReminder`** на API напоминаний.

---

## 1) Источники текущей логики

| Назначение | Файл |
|------------|------|
| Меню, новый/изменение расчёта, приём вложений | `server/telegram_dealer_bot/queryLines/calculationsOrder/calculationsOrder.js` |
| Подтвердить в работу (цена AW, адрес, телефон) | `server/telegram_dealer_bot/queryLines/calculationsOrder/handleCalculationDoneOrder.js` |
| Маршруты callback | `server/telegram_dealer_bot/helpers/chatCommandHandler.js` — `/calculations`, `/new_calculation`, `/editing_calculation`, `/editing_calculation_done_order` |
| Флаги сессии, финализация расчёта | `server/telegram_dealer_bot/routes/auth.js` — `awaitingCalculation`, `awaitingCalculationEdite`, `finish_calc`, … |
| AW API | `server/telegram_dealer_bot/helpers/api.js` — `getTotalPriceOrderAW` |
| Сброс состояния | `server/telegram_dealer_bot/helpers/buttonCancel.js` |

---

## 2) Пункты меню и ветки

### 2.1 Новый расчёт (`/new_calculation`)

- Включается **`awaitingCalculation = true`**.
- Пользователь может слать **текст**, **документы**, **фото** (обработка в `handleAwaitingCalculation` / `auth.js`).
- Накопление: `associatedTexts`, `fileIds`, `photoIds`.
- Завершение: кнопка / команда **`finish_calc`** → **`finalizeCalculation`** — запись в **`calculations_bot_dealers`**, **`createReminder`** с **`typeReminders: 'calculation'`** (см. `calculationsOrder.js`, функция `finalizeCalculation`).

### 2.2 Изменение расчёта (`/editing_calculation`)

- **`awaitingCalculationEdite = true`** → запрос **номера расчёта**.
- После номера — тот же режим ввода, что новый расчёт, с **`importance: 'hight'`** и привязкой к номеру (`calculationNumber`).
- Приоритет обработки в `auth.js` выше, чем у «нового расчёта», если оба флага пересекаются (см. порядок условий в `routes/auth.js`).

### 2.3 Подтвердить в работу (`/editing_calculation_done_order`)

Файл **`handleCalculationDoneOrder.js`**:

| Этап | Поведение |
|------|-----------|
| 0 | Запрос номера расчёта из Альтавина (`awaitingCalculationDoneOrder = 1`). |
| 1 | `getTotalPriceOrderAW(orderNo, companyInn, isButton)` — снятие ведущих нулей у номера из текста. Если **несколько заказов** — кнопки выбора по `ORDERNO`. Если одна цена — показ суммы, кнопки Да/Нет. |
| Подтверждение цены | Сбор **адреса** и **телефона**, затем **`createReminder`** менеджеру (МПП по компании). |

**Зависимость:** наличие **`companyInn`** в сессии (кнопка в меню расчётов показывается только при непустом ИНН).

---

## 3) Данные и контракты для `mobile_app`

| Интеграция | Назначение |
|------------|------------|
| `getTotalPriceOrderAW` | Те же аргументы: номер заказа, ИНН, признак повторного выбора кнопкой; обработка массива vs `{ totalPrice }`. |
| `createReminder` | Единый шлюз (`reminderGateway`); заголовок/теги без привязки к `chatId` — заменить на идентификаторы POZ. |
| БД `calculations_bot_dealers` | Сохранять те же поля, что пишет `finalizeCalculation`, если мобильный клиент шлёт многошаговую заявку. |

**State:** в боте — `userSessions[chatId]`. Для POZ — **серверные сессии или БД** (`modules/shared/sessionFlows`), чтобы не терять шаги при перезапуске процесса.

---

## 4) Приоритет переноса (из общей карты)

Относится к **P2**: после критичных сверки/доставки/рекламаций.

---

## 5) Паритет и тесты

- [ ] Новый расчёт: несколько сообщений + вложения + явное завершение.
- [ ] Изменение: сначала номер, затем вложения/текст, повышенный приоритет в напоминании (как в боте).
- [ ] Подтверждение в работу: ветвление «несколько заказов», подтверждение суммы, адрес и телефон, напоминание МПП.
- [ ] Отмена (`handleCancel`) очищает `awaitingCalculation`, `awaitingCalculationEdite`, `awaitingCalculationDoneOrder`, связанные поля.
- [ ] Нет прямого TCP к 1С из мобильного клиента; вызовы AW только через `mobile_app`.

---

*Документ составлен по `calculationsOrder.js`, `handleCalculationDoneOrder.js`, `chatCommandHandler.js`.*
