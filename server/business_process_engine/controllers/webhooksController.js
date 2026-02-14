const {
  runProcessFromGateway,
  runProcessFromGatewayProject,
  runProcessFromGatewayJoin,
  runProcessFromGatewayJoinProject,
} = require('../engine/runner')

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

async function projectUpdated(dbPool, req, res) {
  try {
    const idRaw = req.body?.global_task_id ?? req.body?.project_id
    if (!idRaw) {
      return res.status(400).json({ error: 'Не указан global_task_id / project_id' })
    }
    res.status(202).json({ accepted: true })
    const globalTaskId = Number(idRaw)
    if (!Number.isFinite(globalTaskId) || globalTaskId <= 0) return
    runProcessFromGatewayProject(dbPool, globalTaskId).catch((err) => {
      console.error('runProcessFromGatewayProject error:', err)
    })
    runProcessFromGatewayJoinProject(dbPool, globalTaskId).catch((err) => {
      console.error('runProcessFromGatewayJoinProject error:', err)
    })
  } catch (err) {
    console.error('projectUpdated webhook:', err)
    res.status(500).json({ error: 'Ошибка обработки вебхука' })
  }
}

module.exports = { taskUpdated, projectUpdated }
