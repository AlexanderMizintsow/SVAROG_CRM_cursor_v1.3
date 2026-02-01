const { runProcessFromGateway, runProcessFromGatewayJoin } = require('../engine/runner')

async function taskUpdated(dbPool, req, res) {
  try {
    const { task_id } = req.body
    if (!task_id) {
      return res.status(400).json({ error: 'Не указан task_id' })
    }
    res.status(202).json({ accepted: true })
    const taskId = Number(task_id)
    runProcessFromGateway(dbPool, taskId).catch((err) => {
      console.error('runProcessFromGateway error:', err)
    })
    runProcessFromGatewayJoin(dbPool, taskId).catch((err) => {
      console.error('runProcessFromGatewayJoin error:', err)
    })
  } catch (err) {
    console.error('taskUpdated webhook:', err)
    res.status(500).json({ error: 'Ошибка обработки вебхука' })
  }
}

module.exports = { taskUpdated }
