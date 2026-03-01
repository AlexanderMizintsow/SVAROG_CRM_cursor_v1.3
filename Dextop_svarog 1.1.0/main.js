const {
  app,
  BrowserWindow,
  Notification,
  ipcMain,
  Tray,
  Menu,
  dialog,
  screen,
} = require("electron");
const path = require("path");

let mainWindow;
let callNotificationWindow; // Окно уведомления о звонке
let tray;
let isFlashing = false;
let flashInterval;
let currentIcon; // Добавляем переменную для хранения текущей иконки

// ============ IPC ОБРАБОТЧИКИ (регистрируем сразу) ============

// Обработка уведомлений - показываем только если окно не активно или свёрнуто
ipcMain.on("send-notification", (event, notificationData) => {
  console.log("=== IPC: Получено уведомление ===");
  console.log("Title:", notificationData?.title);
  console.log("Body:", notificationData?.body);
  
  if (!mainWindow) {
    console.log("mainWindow не существует!");
    return;
  }
  
  try {
    const isMinimized = mainWindow.isMinimized();
    const isFocused = mainWindow.isFocused();
    const isVisible = mainWindow.isVisible();
    
    console.log("isMinimized:", isMinimized, "isFocused:", isFocused, "isVisible:", isVisible);
    
    // Показываем Windows-уведомление если окно свёрнуто, не в фокусе или скрыто
    const shouldShowNotification = isMinimized || !isFocused || !isVisible;
    console.log("shouldShowNotification:", shouldShowNotification);
    
    if (shouldShowNotification) {
      // Проверяем поддержку уведомлений
      if (!Notification.isSupported()) {
        console.log("Уведомления НЕ поддерживаются в этой системе!");
        return;
      }
      
      const iconPath = path.join(app.getAppPath(), "assets/icon.ico");
      console.log("Путь к иконке:", iconPath);
      
      const notification = new Notification({
        title: notificationData.title || "Уведомление",
        body: notificationData.body || "",
        icon: iconPath,
        silent: false,
        timeoutType: "never", // Уведомление не исчезает автоматически
      });
      
      notification.on("show", () => {
        console.log("Событие show - уведомление отображено");
      });
      
      notification.on("click", () => {
        console.log("Клик по уведомлению");
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      });
      
      notification.on("close", () => {
        console.log("Уведомление закрыто");
      });
      
      notification.on("failed", (event, error) => {
        console.error("Ошибка показа уведомления:", error);
      });
      
      notification.show();
      console.log("notification.show() вызван");
      
      // Мигание иконки в трее
      if (typeof startFlashingIcon === "function") {
        startFlashingIcon();
      }
    } else {
      console.log("Уведомление НЕ показано - окно активно");
    }
  } catch (error) {
    console.error("Ошибка при обработке уведомления:", error);
  }
});

// ============ КОНЕЦ IPC ОБРАБОТЧИКОВ ============

// Функция для создания окна уведомления о звонке
function createCallNotificationWindow(callData) {
  // Получаем размеры экрана
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  // Создаем окно уведомления в правом верхнем углу
  callNotificationWindow = new BrowserWindow({
    width: 350,
    height: 250,
    x: width - 370, // 20px отступ от правого края
    y: 20, // 20px отступ от верхнего края
    frame: false, // Убираем рамку окна
    resizable: false,
    alwaysOnTop: true, // Окно всегда поверх других
    skipTaskbar: true, // Не показываем в панели задач
    show: false, // Сначала скрыто
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: false,
    },
  });

  // Загружаем HTML контент напрямую (для работы после билда)
  callNotificationWindow.loadURL(
    "data:text/html;charset=utf-8," +
      encodeURIComponent(`
     <!DOCTYPE html>
     <html>
     <head>
         <title>Входящий звонок</title>
         <style>
             body {
                 background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                 color: white;
                 font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                 font-size: 16px;
                 margin: 0;
                 padding: 20px;
                 text-align: center;
                 height: 100vh;
                 display: flex;
                 flex-direction: column;
                 justify-content: center;
                 align-items: center;
                 user-select: none;
                 cursor: pointer;
                 overflow: hidden;
             }
             
             .phone-icon {
                 font-size: 48px;
                 margin-bottom: 15px;
                 animation: pulse 2s infinite;
             }
             
             @keyframes pulse {
                 0% { transform: scale(1); opacity: 1; }
                 50% { transform: scale(1.1); opacity: 0.8; }
                 100% { transform: scale(1); opacity: 1; }
             }
             
             .call-title {
                 font-size: 18px;
                 font-weight: bold;
                 margin-bottom: 15px;
                 text-shadow: 0 2px 4px rgba(0,0,0,0.3);
             }
             
             .caller-info {
                 margin-bottom: 20px;
                 background: rgba(255, 255, 255, 0.1);
                 padding: 15px;
                 border-radius: 10px;
                 backdrop-filter: blur(10px);
             }
             
             .caller-name {
                 font-size: 16px;
                 font-weight: 600;
                 margin-bottom: 8px;
             }
             
             .caller-number {
                 font-size: 14px;
                 opacity: 0.9;
                 margin-bottom: 5px;
             }
             
             .caller-type {
                 font-size: 12px;
                 opacity: 0.7;
                 text-transform: uppercase;
                 letter-spacing: 1px;
             }
             
             .click-hint {
                 font-size: 12px;
                 opacity: 0.8;
                 margin-top: 15px;
                 padding: 8px 15px;
                 background: rgba(255, 255, 255, 0.2);
                 border-radius: 20px;
                 transition: all 0.3s ease;
             }
             
             .click-hint:hover {
                 background: rgba(255, 255, 255, 0.3);
                 transform: scale(1.05);
             }
             
             .close-button {
                 position: absolute;
                 top: 10px;
                 right: 10px;
                 width: 25px;
                 height: 25px;
                 background: rgba(255, 255, 255, 0.2);
                 border: none;
                 border-radius: 50%;
                 color: white;
                 font-size: 16px;
                 cursor: pointer;
                 display: flex;
                 align-items: center;
                 justify-content: center;
                 transition: all 0.3s ease;
             }
             
             .close-button:hover {
                 background: rgba(255, 255, 255, 0.3);
                 transform: scale(1.1);
             }
         </style>
     </head>
     <body>
         <button class="close-button" id="closeButton">×</button>
         
         <div class="phone-icon">📞</div>
         <div class="call-title" id="callTitle">Входящий звонок</div>
         
         <div class="caller-info">
             <div class="caller-name" id="callerName">Загрузка...</div>
             <div class="caller-number" id="callerNumber"></div>
             <div class="caller-type" id="callerType"></div>
         </div>
         
         <div class="click-hint">Нажмите для открытия приложения</div>
         
         <script>
             console.log('HTML загружен');
             
             const { ipcRenderer } = require('electron');
             
             // Получаем данные о звонке
             ipcRenderer.on('call-data', (event, callData) => {
                 console.log('Получены данные звонка:', callData);
                 
                 // Обновляем информацию в интерфейсе
                 document.getElementById('callerName').textContent = callData.callerName || 'Неизвестный';
                 document.getElementById('callerNumber').textContent = callData.callerNumber || '';
                 
                 // Определяем тип звонящего
                 let callerTypeText = '';
                 if (callData.callerType === 'user') {
                     callerTypeText = 'Сотрудник';
                 } else if (callData.callerType === 'dealer') {
                     callerTypeText = 'Дилер';
                 } else if (callData.callerType === 'unknown') {
                     callerTypeText = 'Неизвестный';
                 } else {
                     callerTypeText = 'Клиент';
                 }
                 document.getElementById('callerType').textContent = callerTypeText;
                 
                 // Обновляем заголовок в зависимости от типа звонка
                 if (callData.type === 'incoming_call') {
                     document.getElementById('callTitle').textContent = 'Входящий звонок';
                 } else if (callData.type === 'call_started') {
                     document.getElementById('callTitle').textContent = 'Активный звонок';
                 } else if (callData.type === 'call_ended') {
                     document.getElementById('callTitle').textContent = 'Звонок завершен';
                 }
             });
             
             // Обработка клика по всему окну
             document.addEventListener('click', (e) => {
                 if (e.target !== document.getElementById('closeButton')) {
                     console.log('Клик по окну уведомления');
                     ipcRenderer.send('notification-clicked');
                 }
             });
             
             // Обработка клика по кнопке закрытия
             document.getElementById('closeButton').addEventListener('click', (e) => {
                 e.stopPropagation();
                 console.log('Клик по кнопке закрытия');
                 window.close();
             });
             
             // Автоматическое закрытие окна через 30 секунд
             setTimeout(() => {
                 console.log('Автоматическое закрытие окна');
                 window.close();
             }, 30000);
         </script>
     </body>
     </html>
   `)
  );

  // Показываем окно когда оно готово
  callNotificationWindow.once("ready-to-show", () => {
    console.log("Окно уведомления готово к показу");
    callNotificationWindow.show();

    // Отправляем данные о звонке в окно уведомления
    callNotificationWindow.webContents.send("call-data", callData);
    console.log("Данные отправлены в окно уведомления:", callData);
  });

  // Добавляем обработчики для отладки
  callNotificationWindow.webContents.on("did-finish-load", () => {
    console.log("HTML файл загружен в окно уведомления");
  });

  callNotificationWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription) => {
      console.error("Ошибка загрузки HTML файла:", errorCode, errorDescription);
    }
  );

  // Закрываем окно уведомления при закрытии
  callNotificationWindow.on("closed", () => {
    callNotificationWindow = null;
  });

  // Закрываем окно уведомления при закрытии
  callNotificationWindow.on("closed", () => {
    callNotificationWindow = null;
  });
}

// Функция для закрытия окна уведомления о звонке
function closeCallNotificationWindow() {
  if (callNotificationWindow) {
    callNotificationWindow.close();
    callNotificationWindow = null;
  }
}

app.whenReady().then(() => {
  // Создаем окно
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: "SVAROG DEXTOP v1.1.1",
    icon: path.join(app.getAppPath(), "assets/icon.ico"),
    webPreferences: {
      preload: path.join(app.getAppPath(), "preload.js"),
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  mainWindow.loadURL("http://localhost:5173/");
  // mainWindow.loadURL('http://localhost:5173/')

  // Создаем меню
  const menu = Menu.buildFromTemplate([
    {
      label: "Файл",
      submenu: [
        {
          label: "Обновить",
          accelerator: "F5",
          click: () => {
            mainWindow.webContents.reload();
          },
        },
        { type: "separator" },
        {
          label: "Выход",
          accelerator: "Alt+F4",
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: "Вид",
      submenu: [
        {
          label: "Увеличить масштаб",
          accelerator: "CmdOrCtrl+Plus",
          click: () => {
            const currentZoom = mainWindow.webContents.getZoomFactor();
            mainWindow.webContents.setZoomFactor(Math.min(currentZoom + 0.1, 3.0));
          },
        },
        {
          label: "Уменьшить масштаб",
          accelerator: "CmdOrCtrl+-",
          click: () => {
            const currentZoom = mainWindow.webContents.getZoomFactor();
            mainWindow.webContents.setZoomFactor(Math.max(currentZoom - 0.1, 0.5));
          },
        },
        {
          label: "Сбросить масштаб (100%)",
          accelerator: "CmdOrCtrl+0",
          click: () => {
            mainWindow.webContents.setZoomFactor(1.0);
          },
        },
        { type: "separator" },
        {
          label: "Масштаб 75%",
          click: () => {
            mainWindow.webContents.setZoomFactor(0.75);
          },
        },
        {
          label: "Масштаб 90%",
          click: () => {
            mainWindow.webContents.setZoomFactor(0.9);
          },
        },
        {
          label: "Масштаб 100%",
          click: () => {
            mainWindow.webContents.setZoomFactor(1.0);
          },
        },
        {
          label: "Масштаб 110%",
          click: () => {
            mainWindow.webContents.setZoomFactor(1.1);
          },
        },
        {
          label: "Масштаб 125%",
          click: () => {
            mainWindow.webContents.setZoomFactor(1.25);
          },
        },
        {
          label: "Масштаб 150%",
          click: () => {
            mainWindow.webContents.setZoomFactor(1.5);
          },
        },
        { type: "separator" },
        {
          label: "Полноэкранный режим",
          accelerator: "F11",
          click: () => {
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
          },
        },
      ],
    },
    {
      label: "Дебаг",
      submenu: [
        {
          label: "Открыть консоль",
          accelerator: "F12",
          click: () => {
            mainWindow.webContents.openDevTools();
          },
        },
      ],
    },
  ]);

  // Устанавливаем меню для приложения
  Menu.setApplicationMenu(menu);

  // Создаем иконку для системного трея
  currentIcon = path.join(app.getAppPath(), "assets/icon.ico");
  tray = new Tray(currentIcon);
  tray.setToolTip("Desktop App"); // Устанавливаем подсказку для иконки

  // Добавляем обработчик клика на иконку в трее
  tray.on("click", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide(); // Скрываем окно, если оно уже открыто
    } else {
      // Показываем окно, если оно скрыто
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Обработка уведомлений о звонках
  ipcMain.on("call-notification", (event, callData) => {
    try {
      console.log("Получено уведомление о звонке:", callData);

      // Создаем окно уведомления о звонке
      createCallNotificationWindow(callData);

      // Проверяем, активно ли основное окно
      if (!mainWindow.isFocused() || mainWindow.isMinimized()) {
        startFlashingIcon();
      }
    } catch (error) {
      console.error("Ошибка при обработке уведомления о звонке:", error);
    }
  });

  // Обработка завершения звонка
  ipcMain.on("call-ended", (event, callData) => {
    try {
      console.log("Звонок завершен:", callData);

      // Закрываем окно уведомления о звонке
      closeCallNotificationWindow();

      // Останавливаем мигание иконки
      stopFlashingIcon();
    } catch (error) {
      console.error("Ошибка при обработке завершения звонка:", error);
    }
  });

  // Обработка клика по окну уведомления
  ipcMain.on("notification-clicked", () => {
    console.log("Получен клик по окну уведомления");

    // Показываем основное окно приложения
    if (mainWindow) {
      console.log("Состояние основного окна:", {
        isVisible: mainWindow.isVisible(),
        isMinimized: mainWindow.isMinimized(),
        isFocused: mainWindow.isFocused(),
      });

      // Проверяем состояние окна и восстанавливаем его
      if (mainWindow.isMinimized()) {
        console.log("Окно свернуто, восстанавливаем...");
        mainWindow.restore();
      }

      if (!mainWindow.isVisible()) {
        console.log("Окно скрыто, показываем...");
        mainWindow.show();
      }

      // Устанавливаем фокус на окно
      mainWindow.focus();

      // Принудительно выводим окно на передний план
      mainWindow.setAlwaysOnTop(true);
      setTimeout(() => {
        mainWindow.setAlwaysOnTop(false);
      }, 100);

      console.log("Основное окно восстановлено и активировано");
    } else {
      console.log("Основное окно не найдено!");
    }

    // Закрываем окно уведомления
    if (callNotificationWindow) {
      callNotificationWindow.close();
      callNotificationWindow = null;
    }
  });

  // Останавливаем мигание при показе или фокусе окна
  mainWindow.on("show", stopFlashingIcon);
  mainWindow.on("focus", stopFlashingIcon);
  mainWindow.on("restore", stopFlashingIcon);

  // Добавляем обработчик события close
  mainWindow.on("close", (event) => {
    event.preventDefault(); // Предотвращаем закрытие окна
    dialog
      .showMessageBox(mainWindow, {
        type: "question",
        buttons: ["Да", "Нет"],
        title: "Подтверждение",
        message:
          "Оповещение будет отключено! Вы действительно хотите закрыть приложение? ",
      })
      .then((result) => {
        if (result.response === 0) {
          // Если пользователь нажал "Да"
          mainWindow.destroy(); // Закрываем окно
        }
      });
  });
});

// Функция для начала мигания иконки в трее
function startFlashingIcon() {
  if (isFlashing) return;
  isFlashing = true;

  flashInterval = setInterval(() => {
    // Меняем иконку в трее между основной и мигающей
    currentIcon =
      currentIcon === path.join(app.getAppPath(), "assets/icon.ico")
        ? path.join(app.getAppPath(), "assets/icon_flashing.ico")
        : path.join(app.getAppPath(), "assets/icon.ico");
    tray.setImage(currentIcon);
  }, 1000); // Меняем иконку каждую секунду
}

// Функция для остановки мигания иконки
function stopFlashingIcon() {
  if (!isFlashing) return;
  isFlashing = false;
  clearInterval(flashInterval);
  currentIcon = path.join(app.getAppPath(), "assets/icon.ico"); // Возвращаем основную иконку
  tray.setImage(currentIcon); // Устанавливаем основную иконку
}
