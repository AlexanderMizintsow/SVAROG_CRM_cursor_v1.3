//index.js
const express = require('express')
const cors = require('cors')
const TelegramBot = require('node-telegram-bot-api')
const dbPool = require('./database/db')
const authRoutes = require('./routes/auth')
const multer = require('multer')
const axios = require('axios') // Импорт axios
const FormData = require('form-data') // Импорт FormData
const { initReclamationCron, initReconciliationCron } = require('./helpers/api')
const { initOrders1CCron } = require('./queryLines/orders1c/orders1c')
const CronManager = require('./helpers/cronManager') // Импорт нового менеджера
const { sanitizeFilename } = require('./helpers/fileUtils') // Импорт утилиты для работы с файлами

const app = express()
const port = 5778

app.use(express.json())
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://192.168.57.112:5173', 'http://172.26.32.1:5173'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  })
)
const token = process.env.TELEGRAM_BOT_TOKEN
const bot = new TelegramBot(token, { polling: true })
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    // Проверяем, что файл имеет корректное имя
    if (!file.originalname || file.originalname.trim() === '') {
      return cb(new Error('Некорректное имя файла'), false)
    }
    cb(null, true)
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB максимум
    files: 10, // максимум 10 файлов
  },
})

// Инициализация CronManager
const cronManager = new CronManager()

// Инициализация cron-задач с новым менеджером
const cronJobs = {
  reclamation: initReclamationCron(bot, cronManager),
  reconciliation: initReconciliationCron(bot, cronManager),
}

// Инициализация cron-задач для заказов 1С
const orders1cJobs = initOrders1CCron(bot, cronManager)
if (orders1cJobs.mainJob) {
  cronJobs.orders1c = orders1cJobs.mainJob
}
if (orders1cJobs.lateResponseJob) {
  cronJobs.orders1c_late_response = orders1cJobs.lateResponseJob
}

// Запуск мониторинга здоровья cron-задач
cronManager.startHealthCheck()

// Добавляем endpoint для мониторинга cron-задач
app.get('/api/cron/status', (req, res) => {
  try {
    const status = cronManager.getAllJobsStatus()
    const stats = cronManager.getStats()
    res.json({
      success: true,
      data: {
        status,
        stats,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[API][CRON_STATUS] Ошибка получения статуса:', error)
    res.status(500).json({
      success: false,
      error: 'Ошибка получения статуса cron-задач',
    })
  }
})

// Endpoint для перезапуска cron-задач
app.post('/api/cron/restart/:jobName', (req, res) => {
  try {
    const { jobName } = req.params
    const result = cronManager.restartJob(jobName)

    if (result) {
      res.json({
        success: true,
        message: `Задача ${jobName} перезапущена`,
      })
    } else {
      res.status(404).json({
        success: false,
        error: `Задача ${jobName} не найдена`,
      })
    }
  } catch (error) {
    console.error('[API][CRON_RESTART] Ошибка перезапуска:', error)
    res.status(500).json({
      success: false,
      error: 'Ошибка перезапуска cron-задачи',
    })
  }
})

// Endpoint для остановки/запуска всех cron-задач
app.post('/api/cron/:action', (req, res) => {
  try {
    const { action } = req.params

    switch (action) {
      case 'stop':
        cronManager.stopAllJobs()
        res.json({
          success: true,
          message: 'Все cron-задачи остановлены',
        })
        break
      case 'start':
        cronManager.startAllJobs()
        res.json({
          success: true,
          message: 'Все cron-задачи запущены',
        })
        break
      default:
        res.status(400).json({
          success: false,
          error: 'Неизвестное действие. Используйте "stop" или "start"',
        })
    }
  } catch (error) {
    console.error('[API][CRON_ACTION] Ошибка выполнения действия:', error)
    res.status(500).json({
      success: false,
      error: 'Ошибка выполнения действия с cron-задачами',
    })
  }
})

// Регистрация маршрутов
app.use('/api/auth', authRoutes(bot))

// Новый маршрут для отправки файлов
app.post(
  '/api/sendFiles',
  upload.array('documents'),
  async (req, res) => {
    const chatId = req.body.chat_id
    const text = req.body.text // Получаем текст из тела запроса

    if (!chatId) {
      return res.status(400).json({ error: 'Отсутствует идентификатор чата.' })
    }

    // Отправка текстового сообщения, если оно есть
    if (text) {
      try {
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
          chat_id: chatId,
          text: text,
          parse_mode: 'Markdown', // или 'HTML'
        })
        console.log('Текст успешно отправлен в Telegram:', text)
      } catch (error) {
        console.error('Ошибка при отправке текста в Telegram:', error.message)
        return res.status(500).json({
          error: `Не удалось отправить текст в Telegram: ${error.message}`,
        })
      }
    }

    // Проверяем, есть ли файлы
    if (!req.files || req.files.length === 0) {
      console.log('Файлы не найдены в запросе.')
      return res.status(200).json({
        message: 'Текст успешно отправлен в Telegram, но файлы отсутствуют.',
      })
    }

    // Отправка файлов
    try {
      const sendPromises = req.files.map(async (file) => {
        console.log(`Обработка файла: ${file.originalname}`)
        console.log(`Размер файла: ${file.size} байт`)
        console.log(`MIME тип: ${file.mimetype}`)
        console.log(`Кодировка имени файла:`, Buffer.from(file.originalname).toString('hex'))

        // Дополнительная проверка - если имя файла пришло в неправильной кодировке
        let originalName = file.originalname
        if (Buffer.from(file.originalname, 'latin1').toString('utf8') !== file.originalname) {
          console.log('Имя файла пришло в latin1 кодировке, конвертируем в utf8')
          originalName = Buffer.from(file.originalname, 'latin1').toString('utf8')
          console.log(`После конвертации: ${originalName}`)
        }

        const form = new FormData()
        form.append('chat_id', chatId)

        // Используем утилиту для корректной обработки русских имен файлов
        const safeFilename = sanitizeFilename(originalName)
        console.log(`Исходное имя: ${originalName}`)
        console.log(`Безопасное имя: ${safeFilename}`)

        // Дополнительная проверка - если имя файла содержит иероглифы, заменяем на английское
        let finalFilename = safeFilename
        // Проверяем только на действительно проблемные символы, исключая русские буквы
        if (
          /[\u4e00-\u9fff\u3400-\u4dbf\u20000-\u2a6df\u2a700-\u2b73f\u2b740-\u2b81f\u2b820-\u2ceaf\uf900-\ufaff\u3300-\u33ff\ufe30-\ufe4f]/.test(
            safeFilename
          ) &&
          !/^[a-zA-Z0-9а-яёА-ЯЁ_\-\s.]+$/u.test(safeFilename)
        ) {
          console.log('Обнаружены иероглифы в имени файла, заменяем на английское имя')
          const extension = safeFilename.split('.').pop()
          finalFilename = `document_${Date.now()}.${extension}`
        }

        // Дополнительная проверка - если имя файла содержит неподдерживаемые символы
        if (!/^[a-zA-Z0-9а-яёА-ЯЁ_\-\s.]+$/u.test(finalFilename)) {
          console.log('Имя файла содержит неподдерживаемые символы, заменяем на безопасное')
          const extension = finalFilename.split('.').pop()
          finalFilename = `document_${Date.now()}.${extension}`
        }

        console.log(`Финальное имя для отправки: ${finalFilename}`)

        // СОХРАНЯЕМ ФАЙЛ В ПАПКУ UPLOADS
        try {
          const fs = require('fs')
          const path = require('path')

          // Создаем папку uploads, если её нет
          const uploadsDir = path.join(__dirname, '..', '..', 'uploads')
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true })
            console.log(`Создана папка uploads: ${uploadsDir}`)
          }

          // Сохраняем файл с уникальным именем
          const timestamp = Date.now()
          const savedFilename = `${timestamp}-${finalFilename}`
          const filePath = path.join(uploadsDir, savedFilename)

          fs.writeFileSync(filePath, file.buffer)
          console.log(`Файл сохранен локально: ${filePath}`)

          // Сохраняем информацию о файле в базу данных для истории
          try {
            const db = require('./database/db')
            const query = `
              INSERT INTO sent_messages_notifications (reminders_id, sent_text, sent_files, sent_at)
              VALUES ($1, $2, $3, $4)
              RETURNING id
            `
            const values = [
              req.body.reminders_id || null, // ID напоминания, если есть
              text || '', // Текст сообщения
              [savedFilename], // Массив с именем сохраненного файла
              new Date().toISOString(), // Время отправки
            ]

            const result = await db.query(query, values)
            console.log(`Информация о файле сохранена в БД, ID: ${result.rows[0]?.id}`)
          } catch (dbError) {
            console.warn('Не удалось сохранить информацию о файле в БД:', dbError.message)
          }
        } catch (saveError) {
          console.warn('Не удалось сохранить файл локально:', saveError.message)
        }

        form.append('document', file.buffer, {
          filename: finalFilename,
          contentType: file.mimetype,
        })

        const response = await axios.post(
          `https://api.telegram.org/bot${token}/sendDocument`,
          form,
          {
            headers: {
              ...form.getHeaders(),
            },
          }
        )

        console.log(`Файл ${finalFilename} успешно отправлен в чат ${chatId}`)
        console.log(`Ответ Telegram API:`, response.data)
      })

      await Promise.all(sendPromises) // Параллельная отправка файлов
      res.status(200).json({ message: 'Файлы и текст успешно отправлены в Telegram.' })
    } catch (error) {
      console.error('Ошибка при отправке файлов:', error.message)
      console.error('Детали ошибки:', error.response?.data || error.stack)
      res.status(500).json({
        error: `Не удалось отправить файлы в Telegram: ${error.message}`,
      })
    }
  },
  (error, req, res, next) => {
    // Обработка ошибок multer
    if (error instanceof multer.MulterError) {
      console.error('Ошибка multer:', error.message)
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Файл слишком большой. Максимальный размер: 50MB' })
      }
      if (error.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Слишком много файлов. Максимум: 10 файлов' })
      }
      return res.status(400).json({ error: `Ошибка загрузки файла: ${error.message}` })
    }

    if (error) {
      console.error('Неизвестная ошибка при загрузке файла:', error.message)
      return res.status(500).json({ error: 'Внутренняя ошибка сервера при обработке файла' })
    }

    next()
  }
)

process.on('SIGTERM', () => {
  console.log('Получен SIGTERM. Остановка задач...')
  gracefulShutdown()
})

process.on('SIGINT', () => {
  console.log('Получен SIGINT. Остановка задач...')
  gracefulShutdown()
})

// Функция для корректного завершения работы
function gracefulShutdown() {
  console.log('Начинаем корректное завершение работы...')

  // Остановка CronManager
  cronManager.stopAllJobs()
  cronManager.stopHealthCheck()
  console.log('CronManager остановлен')

  // Остановка cron-задач с проверкой (fallback)
  if (cronJobs.reclamation && typeof cronJobs.reclamation.stop === 'function') {
    cronJobs.reclamation.stop()
    console.log('Cron-задача reclamation остановлена')
  }
  if (cronJobs.reconciliation && typeof cronJobs.reconciliation.stop === 'function') {
    cronJobs.reconciliation.stop()
    console.log('Cron-задача reconciliation остановлена')
  }
  if (cronJobs.orders1c && typeof cronJobs.orders1c.stop === 'function') {
    cronJobs.orders1c.stop()
    console.log('Cron-задача orders1c остановлена')
  }
  if (
    cronJobs.orders1c_late_response &&
    typeof cronJobs.orders1c_late_response.stop === 'function'
  ) {
    cronJobs.orders1c_late_response.stop()
    console.log('Cron-задача orders1c_late_response остановлена')
  }

  // Закрытие пула соединений
  dbPool.end((err) => {
    if (err) {
      console.error('Ошибка закрытия пула соединений:', err)
    } else {
      console.log('Пул соединений закрыт')
    }

    // Остановка бота
    bot.stopPolling()
    console.log('Бот остановлен')

    // Завершение процесса
    console.log('Сервер корректно завершен')
    process.exit(0)
  })
}

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`)
})
