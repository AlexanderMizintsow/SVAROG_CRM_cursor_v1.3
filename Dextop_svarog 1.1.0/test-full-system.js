const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

let mainWindow;
let callNotificationWindow;

// Тестовые данные звонка
const testCallData = {
  type: "incoming_call",
  receiverUserId: 1,
  receiverName: "Тестовый пользователь",
  callerNumber: "89271390907",
  callerName: "Иван Иванов",
  callerType: "user",
  receiverNumber: "89271390907",
  timestamp: new Date().toISOString(),
  channel: "SIP/test-123",
};

// Функция для создания основного окна
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: "SVAROG DEXTOP - Тест системы уведомлений",
    icon: path.join(app.getAppPath(), "assets/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  // Загружаем тестовую страницу
  mainWindow.loadFile(path.join(__dirname, "test-integration.html"));

  // Открываем консоль разработчика для отладки
  mainWindow.webContents.openDevTools();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Функция для создания окна уведомления о звонке
function createCallNotificationWindow(callData) {
  const { screen } = require("electron");

  // Получаем размеры экрана
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  // Создаем окно уведомления в правом верхнем углу
  callNotificationWindow = new BrowserWindow({
    width: 350,
    height: 200,
    x: width - 370, // 20px отступ от правого края
    y: 20, // 20px отступ от верхнего края
    frame: false, // Убираем рамку окна
    resizable: false,
    alwaysOnTop: true, // Окно всегда поверх других
    skipTaskbar: true, // Не показываем в панели задач
    show: false, // Сначала скрыто
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  // Загружаем HTML для уведомления о звонке
  callNotificationWindow.loadFile(
    path.join(__dirname, "call-notification.html")
  );

  // Показываем окно когда оно готово
  callNotificationWindow.once("ready-to-show", () => {
    callNotificationWindow.show();

    // Отправляем данные о звонке в окно уведомления
    callNotificationWindow.webContents.send("call-data", callData);
    console.log("Окно уведомления показано с данными:", callData);
  });

  // Закрываем окно уведомления при закрытии
  callNotificationWindow.on("closed", () => {
    console.log("Окно уведомления закрыто");
    callNotificationWindow = null;
  });

  return callNotificationWindow;
}

// Функция для закрытия окна уведомления о звонке
function closeCallNotificationWindow() {
  if (callNotificationWindow) {
    callNotificationWindow.close();
    callNotificationWindow = null;
  }
}

// Запускаем приложение
app.whenReady().then(() => {
  console.log("🚀 Запуск тестового приложения...");

  // Создаем основное окно
  createMainWindow();

  // Обработка клика по окну уведомления
  ipcMain.on("notification-clicked", () => {
    console.log("📱 Получен клик по окну уведомления");

    // Показываем основное окно приложения
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.restore(); // Восстанавливаем если свернуто
      console.log("✅ Основное окно показано и сфокусировано");
    }

    // Закрываем окно уведомления
    closeCallNotificationWindow();
  });

  // Обработка уведомлений о звонках
  ipcMain.on("call-notification", (event, callData) => {
    try {
      console.log("📞 Получено уведомление о звонке:", callData);

      // Создаем окно уведомления о звонке
      createCallNotificationWindow(callData);

      console.log("✅ Окно уведомления о звонке создано");
    } catch (error) {
      console.error("❌ Ошибка при обработке уведомления о звонке:", error);
    }
  });

  // Обработка завершения звонка
  ipcMain.on("call-ended", (event, callData) => {
    try {
      console.log("📴 Звонок завершен:", callData);

      // Закрываем окно уведомления о звонке
      closeCallNotificationWindow();

      console.log("✅ Окно уведомления о звонке закрыто");
    } catch (error) {
      console.error("❌ Ошибка при обработке завершения звонка:", error);
    }
  });

  // Обработка обычных уведомлений
  ipcMain.on("send-notification", (event, notificationData) => {
    try {
      console.log("📢 Получено обычное уведомление:", notificationData);

      // Здесь можно добавить логику для обычных уведомлений
      console.log("✅ Обычное уведомление обработано");
    } catch (error) {
      console.error("❌ Ошибка при обработке обычного уведомления:", error);
    }
  });

  console.log("✅ Приложение готово к тестированию");
  console.log("📋 Инструкции:");
  console.log('   1. В основном окне нажмите "Отправить уведомление о звонке"');
  console.log(
    "   2. Проверьте появление окна уведомления в правом верхнем углу"
  );
  console.log("   3. Кликните на уведомление для возврата к основному окну");
  console.log("   4. Проверьте логи в консоли разработчика");
});

// Обработка закрытия приложения
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // На macOS пересоздаем окно при клике на иконку dock
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// Обработка ошибок
process.on("uncaughtException", (error) => {
  console.error("❌ Необработанная ошибка:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Необработанное отклонение промиса:", reason);
});
