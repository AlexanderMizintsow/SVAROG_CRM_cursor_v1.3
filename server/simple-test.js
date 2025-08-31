const io = require("socket.io-client");

console.log("🧪 Запуск простого теста подключения...");

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
      receiverName: "Тестовый пользователь",
      callerNumber: "89271390907",
      callerName: "Тестовый звонящий",
      callerType: "user",
      receiverNumber: "89271390907",
      timestamp: new Date().toISOString(),
      channel: "SIP/test-123",
    };

    socket.emit("incoming_call", testCallData);
    console.log("📤 Отправлены данные звонка:", testCallData);
  }, 2000);
});

socket.on("disconnect", () => {
  console.log("❌ Отключен от CRM сервера");
});

socket.on("connect_error", (error) => {
  console.error("❌ Ошибка подключения к CRM серверу:", error.message);
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

// Завершение теста через 10 секунд
setTimeout(() => {
  console.log("🏁 Тестирование завершено");
  socket.disconnect();
  process.exit(0);
}, 10000);
