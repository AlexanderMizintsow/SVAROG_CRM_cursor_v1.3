// cronManager.js - Управление cron-задачами с мониторингом
const cron = require('node-cron')

class CronManager {
  constructor() {
    this.jobs = new Map()
    this.jobStatus = new Map()
    this.healthCheckInterval = null
  }

  // Добавление cron-задачи
  addJob(name, schedule, task, options = {}) {
    console.log(`[CRON_MANAGER] Добавление задачи: ${name}`)

    const job = cron.schedule(
      schedule,
      async () => {
        await this.executeJob(name, task)
      },
      {
        scheduled: true,
        timezone: 'Europe/Moscow',
        ...options,
      }
    )

    // Сохраняем ссылку на задачу
    this.jobs.set(name, job)
    this.jobStatus.set(name, {
      lastRun: null,
      lastSuccess: null,
      lastError: null,
      errorCount: 0,
      isRunning: false,
    })

    // Обработка ошибок cron-задачи
    job.on('error', (error) => {
      console.error(`[CRON_MANAGER][${name}] Ошибка в cron-задаче:`, error)
      this.updateJobStatus(name, {
        lastError: new Date(),
        errorCount: this.jobStatus.get(name).errorCount + 1,
      })
    })

    console.log(`[CRON_MANAGER] Задача ${name} добавлена успешно`)
    return job
  }

  // Выполнение задачи с мониторингом
  async executeJob(name, task) {
    const status = this.jobStatus.get(name)
    if (!status) return

    if (status.isRunning) {
      console.warn(`[CRON_MANAGER][${name}] Задача уже выполняется, пропускаем`)
      return
    }

    status.isRunning = true
    status.lastRun = new Date()

    console.log(`[CRON_MANAGER][${name}] Запуск выполнения`)

    try {
      await task()
      status.lastSuccess = new Date()
      status.errorCount = 0
      console.log(`[CRON_MANAGER][${name}] Выполнение завершено успешно`)
    } catch (error) {
      status.lastError = new Date()
      status.errorCount++
      console.error(`[CRON_MANAGER][${name}] Ошибка выполнения:`, error.message)

      // Если много ошибок подряд, логируем предупреждение
      if (status.errorCount >= 3) {
        console.warn(`[CRON_MANAGER][${name}] Критическое количество ошибок: ${status.errorCount}`)
      }
    } finally {
      status.isRunning = false
    }
  }

  // Обновление статуса задачи
  updateJobStatus(name, updates) {
    const status = this.jobStatus.get(name)
    if (status) {
      Object.assign(status, updates)
    }
  }

  // Получение статуса задачи
  getJobStatus(name) {
    return this.jobStatus.get(name)
  }

  // Получение статуса всех задач
  getAllJobsStatus() {
    const status = {}
    for (const [name, jobStatus] of this.jobStatus) {
      status[name] = { ...jobStatus }
    }
    return status
  }

  // Остановка задачи
  stopJob(name) {
    const job = this.jobs.get(name)
    if (job) {
      job.stop()
      console.log(`[CRON_MANAGER] Задача ${name} остановлена`)
      return true
    }
    return false
  }

  // Остановка всех задач
  stopAllJobs() {
    console.log('[CRON_MANAGER] Остановка всех cron-задач...')
    for (const [name, job] of this.jobs) {
      job.stop()
      console.log(`[CRON_MANAGER] Задача ${name} остановлена`)
    }
  }

  // Запуск задачи
  startJob(name) {
    const job = this.jobs.get(name)
    if (job) {
      job.start()
      console.log(`[CRON_MANAGER] Задача ${name} запущена`)
      return true
    }
    return false
  }

  // Запуск всех задач
  startAllJobs() {
    console.log('[CRON_MANAGER] Запуск всех cron-задач...')
    for (const [name, job] of this.jobs) {
      job.start()
      console.log(`[CRON_MANAGER] Задача ${name} запущена`)
    }
  }

  // Проверка здоровья задач
  startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    this.healthCheckInterval = setInterval(() => {
      this.checkJobsHealth()
    }, 5 * 60 * 1000) // Проверка каждые 5 минут

    console.log('[CRON_MANAGER] Мониторинг здоровья задач запущен')
  }

  // Проверка здоровья задач
  checkJobsHealth() {
    const now = new Date()
    const criticalThreshold = 30 * 60 * 1000 // 30 минут

    for (const [name, status] of this.jobStatus) {
      const job = this.jobs.get(name)
      if (!job) continue

      // Проверяем, не зависла ли задача
      if (status.isRunning && status.lastRun) {
        const runningTime = now.getTime() - status.lastRun.getTime()
        if (runningTime > criticalThreshold) {
          console.warn(
            `[CRON_MANAGER][${name}] Задача выполняется слишком долго: ${Math.round(
              runningTime / 1000
            )}с`
          )

          // Перезапускаем задачу если она зависла
          this.restartJob(name)
        }
      }

      // Проверяем, не было ли критических ошибок
      if (status.errorCount >= 5) {
        console.error(
          `[CRON_MANAGER][${name}] Критическое количество ошибок: ${status.errorCount}, перезапуск задачи`
        )
        this.restartJob(name)
      }
    }
  }

  // Перезапуск задачи
  restartJob(name) {
    console.log(`[CRON_MANAGER] Перезапуск задачи: ${name}`)

    const job = this.jobs.get(name)
    if (job) {
      job.stop()
      setTimeout(() => {
        job.start()
        this.updateJobStatus(name, { errorCount: 0 })
        console.log(`[CRON_MANAGER] Задача ${name} перезапущена`)
      }, 1000) // Задержка 1 секунда перед перезапуском
    }
  }

  // Остановка мониторинга
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
      console.log('[CRON_MANAGER] Мониторинг здоровья задач остановлен')
    }
  }

  // Получение статистики
  getStats() {
    const stats = {
      totalJobs: this.jobs.size,
      runningJobs: 0,
      failedJobs: 0,
      lastCheck: new Date(),
    }

    for (const [name, status] of this.jobStatus) {
      if (status.isRunning) stats.runningJobs++
      if (status.errorCount > 0) stats.failedJobs++
    }

    return stats
  }
}

module.exports = CronManager
