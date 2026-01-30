const { runProcessFromGateway } = require('../engine/runner')

async function taskUpdated(dbPool, req, res) {
  try {
    const { task_id } = req.body
    if (!task_id) {
      return res.status(400).json({ error: 'Не указан task_id' })
    }
    res.status(202).json({ accepted: true })
    runProcessFromGateway(dbPool, Number(task_id)).catch((err) => {
      console.error('runProcessFromGateway error:', err)
    })
  } catch (err) {
    console.error('taskUpdated webhook:', err)
    res.status(500).json({ error: 'Ошибка обработки вебхука' })
  }
}

module.exports = { taskUpdated }
