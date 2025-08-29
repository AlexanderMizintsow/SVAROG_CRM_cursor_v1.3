// queues.js
const Queue = require('bull')

// Настройка Redis (по умолчанию localhost:6379)
const redisConfig = {
  host: 'localhost',
  port: 6379,
}

// Создаем очереди
const reclamationQueue = new Queue('reclamation', { redis: redisConfig })
const reconciliationQueue = new Queue('reconciliation', { redis: redisConfig })

// Обработка ошибок подключения к Redis
reclamationQueue.on('error', (err) => {
  console.error('[QUEUE][ERROR] Reclamation Queue:', err)
})

reconciliationQueue.on('error', (err) => {
  console.error('[QUEUE][ERROR] Reconciliation Queue:', err)
})

module.exports = { reclamationQueue, reconciliationQueue }
