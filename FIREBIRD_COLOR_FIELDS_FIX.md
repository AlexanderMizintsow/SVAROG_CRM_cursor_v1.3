# 🔧 Исправление ошибки полей цветов в Firebird

## ❌ Проблема

При выполнении запроса к базе данных Firebird возникала ошибка:

```
Dynamic SQL Error, SQL error code = -206, Column unknown, ITD.COLORIN, At line 13, column 26
```

## 🔍 Анализ

Проблема была в неправильных названиях полей в SQL запросе. В таблице `ITEMSDETAIL` поля цветов называются:

- `INCOLORID` (ID внутреннего цвета)
- `OUTCOLORID` (ID внешнего цвета)

А не `COLORIN` и `COLOROUT` как было указано в запросе.

## ✅ Решение

### 1. Исправлены названия полей

**Было:**

```sql
CASE
  WHEN itd.COLORIN IS NOT NULL THEN itd.COLORIN
  ELSE ''
END as ITEM_COLORIN,
CASE
  WHEN itd.COLOROUT IS NOT NULL THEN itd.COLOROUT
  ELSE ''
END as ITEM_COLOROUT,
```

**Стало:**

```sql
CASE
  WHEN c_in.TITLE IS NOT NULL THEN c_in.TITLE
  ELSE ''
END as ITEM_COLORIN,
CASE
  WHEN c_out.TITLE IS NOT NULL THEN c_out.TITLE
  ELSE ''
END as ITEM_COLOROUT,
```

### 2. Добавлены JOIN'ы с таблицей COLORS

**Добавлено:**

```sql
LEFT JOIN COLORS c_in ON (c_in.COLORID = itd.INCOLORID)
LEFT JOIN COLORS c_out ON (c_out.COLORID = itd.OUTCOLORID)
```

### 3. Полный исправленный запрос

```sql
SELECT
  o.ORDERID,
  o.ORDERNO,
  o.DATECREATED,
  o.ORDERSTATUS,
  oi.ORDERITEMSID,
  oi.NAME as ITEM_NAME,
  ggt.NAME as STUFF_TYPE,
  g.NAME as MATERIAL_NAME,
  g.MARKING as ITEM_ART,
  CASE
    WHEN c_in.TITLE IS NOT NULL THEN c_in.TITLE
    ELSE ''
  END as ITEM_COLORIN,
  CASE
    WHEN c_out.TITLE IS NOT NULL THEN c_out.TITLE
    ELSE ''
  END as ITEM_COLOROUT,
  itd.WIDTH,
  itd.HEIGHT,
  itd.THICK as LENGTH,
  CASE
    WHEN (itd.ISEXTENDED = 1) THEN itd.QTY
    WHEN (itd.ISEXTENDED = 0) AND (COALESCE(g.AMOUNTGROUPID,0) = 1) THEN itd.QTY*oi.QTY
    ELSE itd.QTY*oi.QTY
  END as ITEM_QTY,
  CASE
    WHEN (itd.ISEXTENDED = 1) THEN itd.QTY*itd.THICK/m.AMFACTOR
    ELSE itd.QTY*itd.THICK*oi.QTY/m.AMFACTOR
  END as ITEM_TOTQTY,
  itd.SAVINGCOST as ITEM_PRICE,
  m.SHORTNAME as ITEM_MESURE
FROM ORDERITEMS oi
JOIN ORDERS o ON o.ORDERID = oi.ORDERID
LEFT JOIN MODELS md ON md.ORDERITEMSID = oi.ORDERITEMSID
JOIN ITEMSDETAIL itd ON (itd.MODELNO = COALESCE(md.MODELNO,0) AND itd.ORDERITEMSID = oi.ORDERITEMSID)
JOIN STUFFS g ON (g.ID=itd.GOODSID)
LEFT JOIN RECALCGROUP rec ON rec.RECALCGROUPID=g.RECALCGROUPID
JOIN STUFFTYPES ggt ON (ggt.ID = g.STUFFTYPEID)
JOIN MEASURE m ON (g.MEASUREID = m.MEASUREID)
LEFT JOIN COLORS c_in ON (c_in.COLORID = itd.INCOLORID)
LEFT JOIN COLORS c_out ON (c_out.COLORID = itd.OUTCOLORID)
WHERE o.DELETED = 0
AND COALESCE(rec.NAME,'') <> 'VIRT'
ORDER BY o.DATECREATED DESC, o.ORDERNO, oi.ORDERITEMSID, g.ID
```

## 📊 Структура таблиц

### ITEMSDETAIL

- `INCOLORID` (INTEGER) - ID внутреннего цвета
- `OUTCOLORID` (INTEGER) - ID внешнего цвета

### COLORS

- `COLORID` (INTEGER) - ID цвета (первичный ключ)
- `TITLE` (VARCHAR) - Наименование цвета

## 🎯 Результат

Теперь запрос корректно:

1. ✅ **Получает ID цветов** из таблицы `ITEMSDETAIL`
2. ✅ **JOIN'ит с таблицей `COLORS`** для получения названий цветов
3. ✅ **Возвращает названия цветов** вместо пустых значений
4. ✅ **Работает без ошибок** в Firebird

## 📝 Файлы изменены

- `server/AW/controllers/statisticsController_new.js` - метод `getFullOrdersData`

## 🚀 Статус

**Исправлено и готово к использованию!** ✅
