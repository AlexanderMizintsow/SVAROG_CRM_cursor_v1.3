const io = require("socket.io-client");

// Тестовый скрипт для проверки системы уведомлений о звонках
const testCallNotifications = () => {
  console.log("🧪 Запуск тестирования системы уведомлений о звонках...");

  // Подключение к CRM серверу
  const socket = io("http://localhost:5004", {
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    console.log("✅ Подключен к CRM серверу");

    // Аутентификация тестового пользователя (ID = 1)
    socket.emit("authenticate", 1);
    console.log("🔐 Отправлена аутентификация для пользователя ID: 1");

    // Симуляция входящего звонка через 2 секунды
    setTimeout(() => {
      console.log("📞 Симулируем входящий звонок...");

      const testCallData = {
        type: "incoming_call",
        receiverUserId: 1,
        receiverName: "Александр Александрович Мизинцов",
        callerNumber: "89271390907",
        callerName: "Тестовый звонящий",
        callerType: "user",
        receiverNumber: "89271390907",
        timestamp: new Date().toISOString(),
        channel: "SIP/test-123",
      };

      socket.emit("incoming_call", testCallData);
    }, 2000);

    // Симуляция начала разговора через 5 секунд
    setTimeout(() => {
      console.log("📱 Симулируем начало разговора...");

      const testCallStartedData = {
        type: "call_started",
        receiverUserId: 1,
        receiverName: "Александр Александрович Мизинцов",
        callerNumber: "89271390907",
        receiverNumber: "89271390907",
        timestamp: new Date().toISOString(),
        channel: "SIP/test-123",
      };

      socket.emit("call_started", testCallStartedData);
    }, 5000);

    // Симуляция завершения звонка через 8 секунд
    setTimeout(() => {
      console.log("📴 Симулируем завершение звонка...");

      const testCallEndedData = {
        type: "call_ended",
        receiverUserId: 1,
        receiverName: "Александр Александрович Мизинцов",
        callerNumber: "89271390907",
        receiverNumber: "89271390907",
        timestamp: new Date().toISOString(),
        channel: "SIP/test-123",
        duration: 180, // 3 минуты
      };

      socket.emit("call_ended", testCallEndedData);
    }, 8000);

    // Завершение теста через 12 секунд
    setTimeout(() => {
      console.log("🏁 Тестирование завершено");
      socket.disconnect();
      process.exit(0);
    }, 12000);
  });

  socket.on("disconnect", () => {
    console.log("❌ Отключен от CRM сервера");
  });

  socket.on("connect_error", (error) => {
    console.error("❌ Ошибка подключения к CRM серверу:", error.message);
    process.exit(1);
  });

  // Обработка входящих уведомлений (для проверки)
  socket.on("incoming_call", (data) => {
    console.log("📨 Получено уведомление о входящем звонке:", data);
  });

  socket.on("call_started", (data) => {
    console.log("📨 Получено уведомление о начале разговора:", data);
  });

  socket.on("call_ended", (data) => {
    console.log("📨 Получено уведомление о завершении звонка:", data);
  });
};

// Проверка аргументов командной строки
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
🧪 Тестирование системы уведомлений о звонках

Использование:
  node test-call-notifications.js [опции]

Опции:
  --help, -h     Показать эту справку
  --user-id <id> ID пользователя для тестирования (по умолчанию: 1)

Примеры:
  node test-call-notifications.js
  node test-call-notifications.js --user-id 2

Примечание: Убедитесь, что CRM сервер запущен на порту 5004
  `);
  process.exit(0);
}

// Запуск тестирования
console.log("🚀 Запуск тестирования системы уведомлений о звонках...");
console.log("📋 Убедитесь, что:");
console.log("   1. CRM сервер запущен на порту 5004");
console.log("   2. Клиентское приложение открыто в браузере");
console.log("   3. Пользователь с ID 1 авторизован в системе");
console.log("");

testCallNotifications();
