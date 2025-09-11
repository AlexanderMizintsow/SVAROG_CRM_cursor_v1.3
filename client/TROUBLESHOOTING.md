# Устранение неполадок - Статистика заказов

## Проблема: 504 Outdated Optimize Dep

### Описание ошибки:

```
Failed to load resource: the server responded with a status of 504 (Outdated Optimize Dep)
@mui_x-date-pickers_AdapterDateFns.js:1
```

### Причина:

Эта ошибка возникает из-за конфликта версий зависимостей в Vite, особенно с пакетом `@mui/x-date-pickers`.

### Решение:

#### 1. Очистка кэша Vite

```bash
cd client
rm -rf node_modules/.vite
rm -rf dist
npm run dev
```

#### 2. Если проблема сохраняется, перезапустите dev сервер:

```bash
# Остановите сервер (Ctrl+C)
# Затем запустите заново
npm run dev
```

#### 3. Альтернативное решение - обновление зависимостей:

```bash
cd client
npm update @mui/x-date-pickers @mui/material @mui/icons-material
```

### Что было исправлено в коде:

1. **Заменили DatePicker на обычные TextField** - это устраняет зависимость от проблемного пакета
2. **Обновили vite.config.js** - добавили настройки optimizeDeps для исключения проблемных пакетов
3. **Изменили формат дат** - теперь используются строки вместо объектов Date

### Новый формат полей дат:

- Вместо `DatePicker` используются `TextField` с `type="date"`
- Даты хранятся как строки в формате "YYYY-MM-DD"
- Добавлена функция `formatDateForAPI()` для корректной отправки на сервер

### Проверка работоспособности:

1. Запустите клиент: `npm run dev`
2. Откройте страницу статистики
3. Проверьте, что поля дат отображаются корректно
4. Попробуйте выбрать даты и выполнить поиск

### Если проблема все еще есть:

1. **Полная переустановка зависимостей:**

```bash
cd client
rm -rf node_modules package-lock.json
npm install
npm run dev
```

2. **Проверьте версии Node.js:**

```bash
node --version  # Должна быть 16+
npm --version   # Должна быть 8+
```

3. **Очистите кэш npm:**

```bash
npm cache clean --force
```

### Дополнительные настройки для Vite:

Если проблемы продолжаются, добавьте в `vite.config.js`:

```javascript
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['@mui/material', '@mui/icons-material'],
    exclude: ['@mui/x-date-pickers', '@mui/x-date-pickers-pro'],
  },
  server: {
    hmr: {
      overlay: false,
    },
  },
  // ... остальные настройки
})
```

### Контакты:

При возникновении проблем обращайтесь к администратору системы.
