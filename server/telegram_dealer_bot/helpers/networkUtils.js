// networkUtils.js - Утилиты для безопасного выполнения сетевых операций
const net = require('net')
const { promisify } = require('util')

// Функция для создания защищенного сетевого соединения
function createProtectedSocket(options = {}) {
  const {
    host = '192.168.57.77',
    port = 8240,
    connectionTimeout = 10000,
    responseTimeout = 30000,
    maxRetries = 3,
  } = options

  return {
    async connect(message, encoding = 'windows-1251') {
      let retries = 0

      while (retries < maxRetries) {
        try {
          return await this._attemptConnection(
            message,
            encoding,
            connectionTimeout,
            responseTimeout
          )
        } catch (error) {
          retries++
          console.warn(`[NETWORK] Попытка ${retries}/${maxRetries} не удалась:`, error.message)

          if (retries >= maxRetries) {
            throw new Error(
              `Не удалось установить соединение после ${maxRetries} попыток: ${error.message}`
            )
          }

          // Ждем перед повторной попыткой
          await this._delay(1000 * retries)
        }
      }
    },

    async _attemptConnection(message, encoding, connectionTimeout, responseTimeout) {
      return new Promise((resolve, reject) => {
        const client = new net.Socket()
        let responseBuffer = ''
        let isProcessing = false
        let connectionTimer
        let responseTimer
        let isResolved = false

        function cleanup() {
          clearTimeout(connectionTimer)
          clearTimeout(responseTimer)
          if (!client.destroyed) {
            client.destroy()
          }
        }

        function resolveOnce(data) {
          if (!isResolved) {
            isResolved = true
            cleanup()
            resolve(data)
          }
        }

        function rejectOnce(error) {
          if (!isResolved) {
            isResolved = true
            cleanup()
            reject(error)
          }
        }

        // Таймаут на подключение
        connectionTimer = setTimeout(() => {
          rejectOnce(new Error(`Таймаут подключения к ${host}:${port} (${connectionTimeout}ms)`))
        }, connectionTimeout)

        // Таймаут на ответ
        responseTimer = setTimeout(() => {
          rejectOnce(new Error(`Таймаут ожидания ответа от ${host}:${port} (${responseTimeout}ms)`))
        }, responseTimeout)

        // Обработка ошибок
        client.on('error', (error) => {
          rejectOnce(new Error(`Ошибка соединения: ${error.message}`))
        })

        client.on('timeout', () => {
          rejectOnce(new Error('Таймаут соединения'))
        })

        // Подключение
        client.connect(port, host, () => {
          clearTimeout(connectionTimer)
          console.log(`[NETWORK] Соединение установлено с ${host}:${port}`)

          try {
            const encodedMessage =
              encoding === 'windows-1251'
                ? require('iconv-lite').encode(message, 'windows-1251')
                : Buffer.from(message, 'utf8')

            client.write(encodedMessage)
            console.log(`[NETWORK] Сообщение отправлено: ${message}`)
          } catch (error) {
            rejectOnce(new Error(`Ошибка отправки сообщения: ${error.message}`))
          }
        })

        // Обработка данных
        client.on('data', (data) => {
          if (isProcessing || isResolved) return
          isProcessing = true

          try {
            clearTimeout(responseTimer)
            const decodedData =
              encoding === 'windows-1251'
                ? require('iconv-lite').decode(data, 'windows-1251')
                : data.toString('utf8')

            responseBuffer += decodedData
            console.log(`[NETWORK] Получено ${data.length} байт, всего: ${responseBuffer.length}`)

            // Проверяем, получен ли полный ответ
            if (this._isResponseComplete(responseBuffer)) {
              resolveOnce(responseBuffer)
            }
          } catch (error) {
            rejectOnce(new Error(`Ошибка обработки данных: ${error.message}`))
          } finally {
            isProcessing = false
          }
        })

        // Закрытие соединения
        client.on('close', () => {
          console.log(`[NETWORK] Соединение с ${host}:${port} закрыто`)
          if (!isResolved) {
            // Если соединение закрылось до получения ответа, но у нас есть данные
            if (responseBuffer.length > 0) {
              resolveOnce(responseBuffer)
            } else {
              rejectOnce(new Error('Соединение закрыто до получения данных'))
            }
          }
        })

        // Проверка завершения ответа
        this._isResponseComplete = (buffer) => {
          const str = typeof buffer === 'string' ? buffer : buffer.toString()
          return str.includes('q11\x01') || str.endsWith('\r\n') || str.includes('\\\\serv8\\')
        }
      })
    },

    async _delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms))
    },
  }
}

// Функция для безопасного выполнения сетевых операций с повторными попытками
async function executeWithRetry(operation, maxRetries = 3, delay = 1000) {
  let lastError

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      console.warn(`[NETWORK] Попытка ${attempt}/${maxRetries} не удалась:`, error.message)

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay * attempt))
      }
    }
  }

  throw lastError
}

// Функция для проверки доступности сервера
async function checkServerHealth(host = '192.168.57.77', port = 8240, timeout = 5000) {
  return new Promise((resolve) => {
    const client = new net.Socket()
    const timer = setTimeout(() => {
      client.destroy()
      resolve(false)
    }, timeout)

    client.on('connect', () => {
      clearTimeout(timer)
      client.destroy()
      resolve(true)
    })

    client.on('error', () => {
      clearTimeout(timer)
      resolve(false)
    })

    client.connect(port, host)
  })
}

module.exports = {
  createProtectedSocket,
  executeWithRetry,
  checkServerHealth,
}
