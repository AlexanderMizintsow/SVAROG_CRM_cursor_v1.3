# Структура базы данных Firebird

## Основные таблицы

### ORDERS (Заказы)

- **ORDERID** (INTEGER) - ID заказа (первичный ключ)
- **PARENTID** (INTEGER) - ID родительского заказа
- **SYSUPDDATE** (TIMESTAMP) - Дата обновления заказа
- **OWNERTYPE** (INTEGER) - Тип владельца
- **ORDERNO** (VARCHAR) - Номер заказа
- **AGREEMENTNO** (VARCHAR) - Номер договора
- **AGREEMENTDATE** (DATE) - Дата договора
- **CURRENCYID** (INTEGER) - ID валюты
- **SELLERID** (INTEGER) - ID продавца
- **CUSTOMERID** (INTEGER) - ID клиента
- **ORDERSTATEID** (INTEGER) - ID состояния заказа
- **PAYTYPEID** (INTEGER) - ID типа оплаты
- **ITEMSTATUSMODE** (INTEGER) - Режим статуса позиций
- **TOTALPRICE** (NUMERIC) - Общая стоимость заказа
- **TOTALPRICELOCK** (NUMERIC) - Заблокированная стоимость
- **PAYMENT** (NUMERIC) - Сумма оплаты
- **LABORIOUSNESS** (INTEGER) - Трудозатраты
- **PRODDATE** (DATE) - Дата производства
- **FACTORYNUM** (VARCHAR) - Заводской номер
- **ADRESSINSTALL** (VARCHAR) - Адрес установки
- **FLOORINSTALL** (VARCHAR) - Этаж установки
- **PHONEINSTALL** (VARCHAR) - Телефон установки
- **DATEORDER** (DATE) - Дата заказа
- **ORDERSTATUS** (INTEGER) - Статус заказа (3-закрыт, 4-в производстве)
- **LASTGENITEM** (INTEGER) - Последний сгенерированный элемент
- **VALID** (INTEGER) - Валидность
- **RCOMMENT** (VARCHAR) - Комментарий
- **RECCOLOR** (INTEGER) - Цвет записи
- **RECFLAG** (INTEGER) - Флаг записи
- **GUIDHI** (BIGINT) - Высокая часть GUID
- **GUIDLO** (BIGINT) - Низкая часть GUID
- **OWNERID** (INTEGER) - ID владельца
- **DELETED** (INTEGER) - Удален ли заказ
- **DATECREATED** (TIMESTAMP) - Дата создания заказа (приоритетная для фильтрации)
- **DATEMODIFIED** (TIMESTAMP) - Дата изменения заказа
- **DATEDELETED** (TIMESTAMP) - Дата удаления
- **ISDEALERADD** (INTEGER) - Добавлен дилером
- **ISDEALERSTARTADD** (INTEGER) - Начато дилером
- **DEALERGUIDHI** (BIGINT) - GUID дилера (высокая часть)
- **DEALERGUIDLO** (BIGINT) - GUID дилера (низкая часть)
- **ISRESERVED** (INTEGER) - Зарезервирован
- **APPROVEDOCUMENTID** (INTEGER) - ID утвержденного документа
- **ACCOUNTID** (INTEGER) - ID счета
- **WPREQUESTID** (INTEGER) - ID запроса на производство
- **CROSSRATE** (NUMERIC) - Кросс-курс
- **GUID** (VARCHAR) - GUID заказа
- **DEALERGUID** (VARCHAR) - GUID дилера
- **PROJECTID** (INTEGER) - ID проекта
- **ADDRLATITUDE** (NUMERIC) - Широта адреса
- **ADDRLONGITUDE** (NUMERIC) - Долгота адреса
- **LEADID** (INTEGER) - ID лида
- **PAYERID** (INTEGER) - ID плательщика
- **CONTRACTID** (INTEGER) - ID контракта
- **EXPORT_VERSION** (INTEGER) - Версия экспорта
- **ORIGIN_ORDERNO** (VARCHAR) - Оригинальный номер заказа
- **WAITING_IMPORT_STATUS** (INTEGER) - Статус ожидания импорта
- **IMPORT_STATUS_DATE** (TIMESTAMP) - Дата статуса импорта
- **IMPORT_STATUS** (INTEGER) - Статус импорта
- **FACTORY_ORDERNO** (VARCHAR) - Заводской номер заказа
- **CALCTOTALPRICE** (NUMERIC) - Расчетная общая стоимость
- **FIXEDTOTALPRICE** (NUMERIC) - Фиксированная общая стоимость
- **STUFFS_REQUIREMENTS_COMPLETED** (INTEGER) - Требования к материалам выполнены

### ORDERITEMS (Позиции заказов)

- **ORDERITEMSID** (INTEGER) - ID позиции заказа (первичный ключ)
- **ORDERID** (INTEGER) - ID заказа (внешний ключ)
- **NAME** (VARCHAR) - Наименование позиции
- **PRICE** (NUMERIC) - Цена
- **QTY** (INTEGER) - Количество
- **COSTALL** (NUMERIC) - Общая стоимость
- **LABORIOUSNESS** (INTEGER) - Трудозатраты
- **AREA** (INTEGER) - Площадь
- **RCOMMENT** (VARCHAR) - Комментарий
- **ISADDITION** (INTEGER) - Является ли дополнением
- **USEDQTY** (INTEGER) - Использованное количество
- **USEDADDQTY** (INTEGER) - Использованное дополнительное количество
- **THUMBS** (BLOB) - Миниатюры
- **VALID** (INTEGER) - Валидность
- **PACKINFO** (BLOB) - Информация об упаковке
- **PRODUCTCOUNT** (INTEGER) - Количество продукции
- **WIDTH** (INTEGER) - Ширина
- **HEIGHT** (INTEGER) - Высота
- **WPREQUESTDETAILID** (INTEGER) - ID детали запроса на производство
- **PROJECTITEMID** (INTEGER) - ID элемента проекта
- **WEIGHT** (NUMERIC) - Вес
- **CALCPRICE** (NUMERIC) - Расчетная цена
- **FIXEDPRICE** (NUMERIC) - Фиксированная цена
- **MODELCALCDATE** (TIMESTAMP) - Дата расчета модели

### MODELS (Модели)

- **ORDERITEMSID** (INTEGER) - ID позиции заказа (внешний ключ)
- **MODELID** (INTEGER) - ID модели
- **MODELNO** (INTEGER) - Номер модели

### ITEMSDETAIL (Детали позиций)

- **ITEMSDETAILID** (INTEGER) - ID детали позиции (первичный ключ)
- **ORDERITEMSID** (INTEGER) - ID позиции заказа (внешний ключ)
- **SETID** (INTEGER) - ID набора
- **SETINDEX** (INTEGER) - Индекс набора
- **GRGOODSID** (INTEGER) - ID группы товаров
- **GOODSID** (INTEGER) - ID товара (внешний ключ)
- **CHILDID** (INTEGER) - ID дочернего элемента
- **MODELPARTID** (INTEGER) - ID части модели
- **POSITIONID** (INTEGER) - ID позиции
- **PARTNUM** (VARCHAR) - Номер части
- **MODELNO** (INTEGER) - Номер модели
- **WIDTH** (INTEGER) - Ширина
- **HEIGHT** (INTEGER) - Высота
- **THICK** (INTEGER) - Толщина
- **QTY** (INTEGER) - Количество
- **ANG1** (INTEGER) - Угол 1
- **ANG2** (INTEGER) - Угол 2
- **RADIUS** (INTEGER) - Радиус
- **PRICETYPE** (INTEGER) - Тип цены
- **WEIGHT** (NUMERIC) - Вес
- **PRICE** (NUMERIC) - Цена
- **CONNECTION1** (VARCHAR) - Соединение 1
- **CONNECTION2** (VARCHAR) - Соединение 2
- **ADDITIONAL** (VARCHAR) - Дополнительно
- **ISEXTENDED** (INTEGER) - Расширенный
- **SAVING** (NUMERIC) - Экономия
- **SAVINGABS** (NUMERIC) - Абсолютная экономия
- **UPDATESTATUS** (INTEGER) - Статус обновления
- **RCOMMENT** (VARCHAR) - Комментарий
- **ALLVOLUME** (NUMERIC) - Общий объем
- **COST** (NUMERIC) - Стоимость
- **SAVINGCOST** (NUMERIC) - Экономия стоимости
- **ALLSAVINGVOLUME** (NUMERIC) - Общая экономия объема
- **ALLWEIGHT** (NUMERIC) - Общий вес
- **INCOLORID** (INTEGER) - ID внутреннего цвета
- **OUTCOLORID** (INTEGER) - ID внешнего цвета
- **ITEMSSETSID** (INTEGER) - ID набора позиций
- **INT_MARKING** (VARCHAR) - Внутренняя маркировка
- **IZDPART** (VARCHAR) - Часть изделия
- **PARTSIDE** (VARCHAR) - Сторона части
- **EVALUESID** (INTEGER) - ID значений элемента
- **MARK** (VARCHAR) - Марка
- **ELEMENTUID** (VARCHAR) - UID элемента
- **MODELID** (INTEGER) - ID модели

### STUFFS (Материалы/Товары)

- **ID** (INTEGER) - ID товара (первичный ключ)
- **AMOUNTGROUPID** (INTEGER) - ID группы количества
- **STUFFTYPEID** (INTEGER) - ID типа товара (внешний ключ)
- **NAME** (VARCHAR) - Наименование
- **MARKING** (VARCHAR) - Маркировка
- **LABEL** (VARCHAR) - Метка
- **INCOLORID** (INTEGER) - ID внутреннего цвета
- **OUTCOLORID** (INTEGER) - ID внешнего цвета
- **CURRENCYID** (INTEGER) - ID валюты
- **PRICE1** (NUMERIC) - Цена 1
- **PRICE2** (NUMERIC) - Цена 2
- **RECALCGROUPID** (INTEGER) - ID группы пересчета
- **MARKUPGROUPID** (INTEGER) - ID группы наценки
- **CRYPT_PRICE1** (BLOB) - Зашифрованная цена 1
- **CRYPT_PRICE2** (BLOB) - Зашифрованная цена 2
- **OPTIMIZABLE** (INTEGER) - Оптимизируемый
- **LINEARGRADEID** (INTEGER) - ID линейного сорта
- **PLANARGRADEID** (INTEGER) - ID плоского сорта
- **LINEARCUTTERID** (INTEGER) - ID линейного резака
- **PLANARCUTTERID** (INTEGER) - ID плоского резака
- **PURCHASEPOLICY** (INTEGER) - Политика закупки
- **MINIMALQTY** (INTEGER) - Минимальное количество
- **OPTIMALQTY** (INTEGER) - Оптимальное количество
- **LEADTIME** (INTEGER) - Время выполнения
- **ALLOWSALE** (INTEGER) - Разрешить продажу
- **DENYDEALERSALE** (INTEGER) - Запретить продажу дилерам
- **ALLOWDEALERSAVE** (INTEGER) - Разрешить сохранение дилерам
- **CRYPT_ALLOWDEALERSAVE** (BLOB) - Зашифрованное разрешение сохранения дилерам
- **MEASUREID** (INTEGER) - ID единицы измерения
- **WEIGHT** (NUMERIC) - Вес
- **WASTE** (NUMERIC) - Отходы
- **IMAGEID** (INTEGER) - ID изображения
- **DIRECTEDPATTERN** (VARCHAR) - Направленный шаблон
- **USEWAREHOUSE** (INTEGER) - Использовать склад
- **ATTRIBUTES** (BLOB) - Атрибуты
- **LASTEDITORID** (INTEGER) - ID последнего редактора
- **RCOMMENT** (VARCHAR) - Комментарий
- **ISADD** (INTEGER) - Является ли дополнением
- **RECCOLOR** (INTEGER) - Цвет записи
- **RECFLAG** (INTEGER) - Флаг записи
- **OWNERID** (INTEGER) - ID владельца
- **GUID** (VARCHAR) - GUID
- **DELETED** (INTEGER) - Удален
- **DATECREATED** (TIMESTAMP) - Дата создания
- **DATEMODIFIED** (TIMESTAMP) - Дата изменения
- **DATEDELETED** (TIMESTAMP) - Дата удаления
- **USEWASTE** (INTEGER) - Использовать отходы
- **BLANKSIZEID** (INTEGER) - ID размера заготовки
- **REGULARSIZEID** (INTEGER) - ID регулярного размера

### STUFFTYPES (Типы товаров)

- **ID** (INTEGER) - ID типа товара (первичный ключ)
- **NAME** (VARCHAR) - Наименование типа
- **CODE** (VARCHAR) - Код типа
- **LABEL** (VARCHAR) - Метка
- **POSIT** (INTEGER) - Позиция
- **RCOMMENT** (VARCHAR) - Комментарий
- **ISADD** (INTEGER) - Является ли дополнением
- **RECCOLOR** (INTEGER) - Цвет записи
- **RECFLAG** (INTEGER) - Флаг записи
- **OWNERID** (INTEGER) - ID владельца
- **GUID** (VARCHAR) - GUID
- **DELETED** (INTEGER) - Удален
- **DATECREATED** (TIMESTAMP) - Дата создания
- **DATEMODIFIED** (TIMESTAMP) - Дата изменения
- **DATEDELETED** (TIMESTAMP) - Дата удаления

### MEASURE (Единицы измерения)

- **MEASUREID** (INTEGER) - ID единицы измерения (первичный ключ)
- **NAME** (VARCHAR) - Наименование единицы измерения
- **SHORTNAME** (VARCHAR) - Краткое наименование
- **GRMEASUREID** (INTEGER) - ID группы единиц измерения
- **AMFACTOR** (NUMERIC) - Коэффициент количества

### COLORS (Цвета)

- **COLORID** (INTEGER) - ID цвета (первичный ключ)
- **TITLE** (VARCHAR) - Наименование цвета

### MODELPARTS (Части моделей)

- **MODELPARTID** (INTEGER) - ID части модели (первичный ключ)
- **MODELID** (INTEGER) - ID модели
- **NAME** (VARCHAR) - Наименование части

### MODELFILLINGS (Заполнения моделей)

- **MODELFILLINGID** (INTEGER) - ID заполнения модели (первичный ключ)
- **MODELPARTID** (INTEGER) - ID части модели (внешний ключ)
- **GEOMETRY** (INTEGER) - Геометрия (0-прямоугольник, 1-треугольник, 2-арка, 3-арка с треугольником)
- **SHPROSSES** (INTEGER) - Шпроссы (0-без шпроссов, 1-со шпроссами)

### RECALCGROUP (Группы пересчета)

- **RECALCGROUPID** (INTEGER) - ID группы пересчета (первичный ключ)
- **NAME** (VARCHAR) - Наименование группы

## Связи между таблицами

1. **ORDERS** → **ORDERITEMS** (один ко многим по ORDERID)
2. **ORDERITEMS** → **MODELS** (один к одному по ORDERITEMSID)
3. **ORDERITEMS** → **ITEMSDETAIL** (один ко многим по ORDERITEMSID)
4. **ITEMSDETAIL** → **STUFFS** (многие к одному по GOODSID)
5. **STUFFS** → **STUFFTYPES** (многие к одному по STUFFTYPEID)
6. **STUFFS** → **MEASURE** (многие к одному по MEASUREID)
7. **ITEMSDETAIL** → **COLORS** (многие к одному по INCOLORID/OUTCOLORID)
8. **ITEMSDETAIL** → **MODELPARTS** (многие к одному по MODELPARTID)
9. **MODELPARTS** → **MODELFILLINGS** (один ко многим по MODELPARTID)
10. **STUFFS** → **RECALCGROUP** (многие к одному по RECALCGROUPID)

## Коды типов товаров (STUFFTYPES.CODE)

- **Profil** - Профиль
- **SP** - Стеклопакеты
- **Work** - Работы
- **Shpros** - Шпроссы
- **Dop_Profil_Optim** - Дополнительный профиль оптимизации
- **Uslugi** - Услуги

## Статусы заказов (ORDERS.ORDERSTATUS)

- **3** - Закрыт
- **4** - В производстве

## Важные поля для фильтрации

- **DATECREATED** - Дата создания заказа (приоритетная для фильтрации по датам)
- **ORDERSTATUS** - Статус заказа (для фильтрации по статусам)
- **STUFFTYPES.CODE** - Код типа товара (для фильтрации по типам материалов)
- **STUFFS.NAME** - Наименование материала (для поиска конкретных материалов)
