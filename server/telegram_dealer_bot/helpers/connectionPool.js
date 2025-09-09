// connectionPool.js - Пул соединений для оптимизации TCP операций
const net = require('net')
const iconv = require('iconv-lite')

class ConnectionPool {
  constructor(options = {}) {
    this.host = options.host || '192.168.57.77'
    this.port = options.port || 8240
    this.maxConnections = options.maxConnections || 5
    this.connectionTimeout = options.connectionTimeout || 10000
    this.responseTimeout = options.responseTimeout || 30000
    this.idleTimeout = options.idleTimeout || 60000 // 1 минута бездействия

    this.connections = new Map()
    this.availableConnections = []
    this.connectionQueue = []
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      queuedRequests: 0,
      errors: 0,
    }
  }

  // Получение соединения из пула
  async getConnection() {
    return new Promise((resolve, reject) => {
      // Если есть доступное соединение, используем его
      if (this.availableConnections.length > 0) {
        const connectionId = this.availableConnections.pop()
        const connection = this.connections.get(connectionId)

        if (connection && !connection.destroyed) {
          this.stats.activeConnections++
          resolve({ connection, connectionId })
          return
        } else {
          // Соединение недействительно, удаляем его
          this.connections.delete(connectionId)
        }
      }

      // Если можем создать новое соединение
      if (this.connections.size < this.maxConnections) {
        this.createConnection()
          .then(({ connection, connectionId }) => {
            this.stats.activeConnections++
            resolve({ connection, connectionId })
          })
          .catch(reject)
      } else {
        // Добавляем в очередь
        this.connectionQueue.push({ resolve, reject })
        this.stats.queuedRequests++
      }
    })
  }

  // Создание нового соединения
  async createConnection() {
    return new Promise((resolve, reject) => {
      const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const connection = new net.Socket()

      let connectionTimeout = setTimeout(() => {
        connection.destroy()
        reject(new Error('Таймаут подключения'))
      }, this.connectionTimeout)

      connection.connect(this.port, this.host, () => {
        clearTimeout(connectionTimeout)
        this.connections.set(connectionId, connection)
        this.stats.totalConnections++

        // Настраиваем обработчики
        connection.on('error', (err) => {
          this.stats.errors++
          this.connections.delete(connectionId)
          this.removeFromAvailable(connectionId)
        })

        connection.on('close', () => {
          this.connections.delete(connectionId)
          this.removeFromAvailable(connectionId)
        })

        resolve({ connection, connectionId })
      })

      connection.on('error', (err) => {
        clearTimeout(connectionTimeout)
        this.stats.errors++
        reject(err)
      })
    })
  }

  // Возврат соединения в пул
  returnConnection(connectionId) {
    const connection = this.connections.get(connectionId)
    if (connection && !connection.destroyed) {
      this.availableConnections.push(connectionId)
      this.stats.activeConnections--

      // Обрабатываем очередь
      if (this.connectionQueue.length > 0) {
        const { resolve } = this.connectionQueue.shift()
        this.stats.queuedRequests--
        resolve({ connection, connectionId })
      }
    } else {
      this.connections.delete(connectionId)
      this.removeFromAvailable(connectionId)
    }
  }

  // Удаление из доступных соединений
  removeFromAvailable(connectionId) {
    const index = this.availableConnections.indexOf(connectionId)
    if (index > -1) {
      this.availableConnections.splice(index, 1)
    }
  }

  // Выполнение запроса через пул соединений
  async executeRequest(message, sScan) {
    const { connection, connectionId } = await this.getConnection()

    return new Promise((resolve, reject) => {
      let responseBuffer = ''
      let isProcessing = false
      let responseTimeout = setTimeout(() => {
        if (!connection.destroyed) {
          connection.destroy()
          reject(new Error('Таймаут ожидания ответа сервера'))
        }
      }, this.responseTimeout)

      const cleanup = () => {
        clearTimeout(responseTimeout)
        this.returnConnection(connectionId)
      }

      const handleError = (err, context) => {
        cleanup()
        reject(new Error(`❌ ${context}: ${err.message}`))
      }

      try {
        // Отправляем запрос
        connection.write(iconv.encode(message, 'windows-1251'))

        // Обрабатываем ответ
        connection.once('data', async (data) => {
          if (isProcessing) return
          isProcessing = true

          try {
            clearTimeout(responseTimeout)
            const decodedData = iconv.decode(data, 'windows-1251')
            responseBuffer += decodedData

            if (responseBuffer.includes('q11\x01')) {
              cleanup()
              resolve(responseBuffer)
            }
          } catch (err) {
            handleError(err, 'Ошибка обработки данных')
          } finally {
            isProcessing = false
          }
        })

        connection.once('error', (err) => {
          handleError(err, 'Ошибка соединения')
        })
      } catch (err) {
        handleError(err, 'Ошибка отправки запроса')
      }
    })
  }

  // Закрытие всех соединений
  closeAll() {
    console.log('[CONNECTION_POOL] Закрытие всех соединений...')

    for (const [connectionId, connection] of this.connections) {
      if (!connection.destroyed) {
        connection.destroy()
      }
    }

    this.connections.clear()
    this.availableConnections = []
    this.connectionQueue = []

    console.log('[CONNECTION_POOL] Все соединения закрыты')
  }

  // Получение статистики
  getStats() {
    return {
      ...this.stats,
      availableConnections: this.availableConnections.length,
      queuedRequests: this.connectionQueue.length,
    }
  }
}

module.exports = ConnectionPool
