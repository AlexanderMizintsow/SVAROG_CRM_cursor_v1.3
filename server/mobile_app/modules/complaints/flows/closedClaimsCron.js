const { complaintsService } = require('../services/complaintsService')

const startClosedClaimsSyncCron = (pool) => {
  const everyMs = Number(process.env.COMPLAINTS_CLOSED_SYNC_MS || 10 * 60 * 1000)

  const run = async () => {
    try {
      const affected = await complaintsService.syncClosedClaimsFromOneC(pool)
      if (affected > 0) {
        console.log('[mobile_app][complaints][cron] closed claims synced:', affected)
      }
    } catch (error) {
      console.error('[mobile_app][complaints][cron] sync failed:', error?.message || error)
    }
  }

  setTimeout(() => {
    void run()
  }, 3000)
  return setInterval(() => {
    void run()
  }, everyMs)
}

module.exports = {
  startClosedClaimsSyncCron,
}
