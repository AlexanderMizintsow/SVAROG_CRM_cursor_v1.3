const { app, BrowserWindow, Notification, ipcMain, Tray } = require('electron')
const path = require('path')

let mainWindow
let tray
let isFlashing = false
let flashInterval

app.on('ready', () => {
  // Создание иконки в трее
  tray = new Tray(path.join(__dirname, 'icon.ico')) // Укажите путь к вашей иконке

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Убедитесь, что путь к preload.js правильный
      contextIsolation: true, // Лучше оставить true для безопасности
      enableRemoteModule: false, // Отключите, если не используете remote
    },
  })

  mainWindow.loadURL('http://localhost:5173/') // Загрузка URL вашего веб-приложения

  ipcMain.on('send-notification', (event, notificationData) => {
    const notification = new Notification({
      title: notificationData.title,
      body: notificationData.body,
    })

    notification.show()

    // Проверяем, свернуто ли приложение
    if (!mainWindow.isVisible()) {
      startFlashing() // Запускаем мигание, если окно свернуто
    }
  })

  mainWindow.on('show', () => {
    stopFlashing() // Останавливаем мигание, когда окно становится видимым
  })

  mainWindow.on('focus', () => {
    stopFlashing() // Останавливаем мигание, когда окно получает фокус
  })

  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
  })
})

app.on('window-all-closed', () => {
  app.quit() // Закрыть приложение, если все окна закрыты
})

function startFlashing() {
  if (!isFlashing) {
    isFlashing = true
    flashInterval = setInterval(() => {
      // Меняем иконку между исходной и изменённой
      const iconPath = isFlashing
        ? path.join(__dirname, 'icon.ico')
        : path.join(__dirname, 'icon_flashing.ico')
      tray.setImage(iconPath) // Устанавливаем иконку
      isFlashing = !isFlashing
    }, 1000) // Измените время интервала по необходимости
  }
}

function stopFlashing() {
  if (isFlashing) {
    clearInterval(flashInterval)
    isFlashing = false

    // Устанавливаем иконку обратно на исходную
    tray.setImage(path.join(__dirname, 'icon.ico')) // Устанавливаем исходную иконку
  }
}
