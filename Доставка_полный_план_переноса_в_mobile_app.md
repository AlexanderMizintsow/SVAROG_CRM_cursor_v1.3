# Доставка: полный план переноса в мобильное приложение

Документ фиксирует раздел **`/delivery`** (файл `deliveryOrder.js`) из `server/telegram_dealer_bot` для переноса в `apk/POZ` + `server/mobile_app`.

**Интеграция с 1С:** **`sendRequest1C`** для **`V3R`** (время доставки) и **`V4R`** (дата доставки). Остальные ветки — **`createReminder`**. Клиент POZ не открывает TCP к 1С; вызовы идут через шлюз `mobile_app`, эквивалентный `sendRequest1C`.

---

## 1) Источники текущей логики

| Назначение | Файл |
|------------|------|
| Меню и все подветки | `server/telegram_dealer_bot/queryLines/deliveryOrder/deliveryOrder.js` |
| Маршруты | `server/telegram_dealer_bot/helpers/chatCommandHandler.js` |
| 1С TCP | `server/telegram_dealer_bot/helpers/api.js` — `sendRequest1C` |
| Сброс флагов | `server/telegram_dealer_bot/helpers/buttonCancel.js` — `awaitingDeliveryOrderTime`, `awaitingDeliveryOrderDate`, `awaitingOrderToPoint`, … |

---

## 2) Пункты меню (как в боте)

При наличии **`companyInn`** в начало меню добавляются:

1. **Уточнить время доставки** — `/delivery_order_time`  
2. **Уточнить дату доставки** — `/delivery_order_date`

Далее для всех:

3. **Уточнить местонахождение водителя** — `/delivery_order_driver_location`  
4. **Сколько стоит доставка до….?** — `/delivery_order_to_point` (многошаговый ввод адреса и типа машины)  
5. **Сообщить об опоздании** — `/delivery_order_driver_delay`  

**В разработке / отключено в коде:** «На какую дату принимаете?» — `deliveryOrderToPointDate`, кнопка закомментирована.

---

## 3) Ветки и интеграции

### 3.1 Время доставки (`deliveryOrderTime`)

- Флаг: **`awaitingDeliveryOrderTime`**.
- Ввод **номера заказа** → запрос **`sendRequest1C('V3R' + order + 'INN' + inn)`**.
- Ответ: разбор как у других `V3R` в `api.js` (текст внутри `;…;`). Показ пользователю или сообщение об отсутствии данных.

### 3.2 Дата доставки (`deliveryOrderDate`)

- Флаг: **`awaitingDeliveryOrderDate`**.
- Запрос: **`V4R{order}INN{inn}`** через **`sendRequest1C`**.

### 3.3 Местонахождение водителя / опоздание

- **`createReminder`** менеджеру (МПП по компании), тексты и типы — как в `deliveryOrder.js` (при переносе зафиксировать в ТЗ по полям `typeReminders`, `textCalc`, `title`).

### 3.4 Стоимость доставки до точки (`deliveryOrderToPoint`)

- Многошаговый сценарий: адрес (в т.ч. выбор города/вариантов в **`deliveryOrderToPointDate`** для другой ветки — не путать с активным меню), тип машины (`passing_car`, `assembly_car`, `separate_car` в `auth.js`), затем **`createReminder`** с собранным текстом.

---

## 4) Требования к переносу

| Тема | Требование |
|------|------------|
| Протокол 1С | Те же строки **`V3R` / `V4R`**, кодировка и паритет ответов с `telegram_dealer_bot`. |
| UX | Сохранить шаги ввода номера заказа для V3R/V4R; маски валидации — по согласованию (в боте минимальная). |
| State | Флаги перенести в серверный flow-store, не в память одного воркера. |
| Приоритет | **P1** в общей карте (время/дата доставки + стоимость до точки). |

---

## 5) Паритет и тесты

- [ ] V3R/V4R: корректный разбор при типичном ответе 1С и при «пусто» / `false`.
- [ ] Напоминания: те же получатели (`getMppByCompany`) и смысл текста.
- [ ] Отмена сбрасывает все `awaiting*` доставки.
- [ ] Нет прямого доступа к 1С с устройства.

---

*Документ составлен по `deliveryOrder.js` и `chatCommandHandler.js`. Точные строки `createReminder` — сверить в теле функций ветки.*
