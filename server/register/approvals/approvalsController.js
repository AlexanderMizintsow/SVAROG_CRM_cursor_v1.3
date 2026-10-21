const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const multer = require('multer')
const engine = require('./approvalEngine')

const approvalUploadsDir = path.join(__dirname, '../../../uploads/approvals')

function approvalUploader() {
  if (!fs.existsSync(approvalUploadsDir)) {
    fs.mkdirSync(approvalUploadsDir, { recursive: true })
  }
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, approvalUploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').slice(0, 12)
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`)
    },
  })
  return multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }).single('file')
}

function userIdOf(req) {
  return Number(req.query.userId || req.body?.userId)
}

function monthRange(month) {
  const [yearText, monthText] = String(month || '').split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText)
  if (!year || !monthIndex) {
    const now = new Date()
    return monthRange(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  }
  const from = new Date(year, monthIndex - 1, 1)
  const to = new Date(year, monthIndex, 1)
  return { from, to }
}

function sendError(res, error) {
  console.error('approvals:', error.message || error)
  res.status(error.status || 500).json({ message: error.message || 'Ошибка согласования' })
}

function registerApprovalRoutes(app, dbPool) {
  engine.setApprovalIo(app.get('io'))
  app.get('/api/approvals/order-states', async (req, res) => {
    try {
      const response = await fetch(`${process.env.AW_BASE_URL || 'http://127.0.0.1:5005'}/app/approval/order-states`)
      const data = await response.json()
      res.json(data.states ? data : { states: [] })
    } catch (error) {
      res.json({ states: [] })
    }
  })

  app.get('/api/approvals/stats', async (req, res) => {
    try {
      res.json(await engine.approvalStats(dbPool, req.query || {}))
    } catch (error) {
      sendError(res, error)
    }
  })

  app.get('/api/approvals/templates', async (req, res) => {
    try {
      res.json(await engine.listTemplates(dbPool, userIdOf(req)))
    } catch (error) {
      sendError(res, error)
    }
  })

  app.get('/api/approvals/templates/:id', async (req, res) => {
    try {
      res.json(await engine.getTemplate(dbPool, Number(req.params.id), userIdOf(req)))
    } catch (error) {
      sendError(res, error)
    }
  })

  app.post('/api/approvals/templates', async (req, res) => {
    try {
      res.status(201).json(await engine.saveTemplate(dbPool, req.body || {}))
    } catch (error) {
      sendError(res, error)
    }
  })

  app.put('/api/approvals/templates/:id', async (req, res) => {
    try {
      res.json(await engine.updateTemplate(dbPool, Number(req.params.id), req.body || {}))
    } catch (error) {
      sendError(res, error)
    }
  })

  app.delete('/api/approvals/templates/:id', async (req, res) => {
    try {
      res.json(await engine.deleteTemplate(dbPool, Number(req.params.id), userIdOf(req)))
    } catch (error) {
      sendError(res, error)
    }
  })

  app.get('/api/approvals/check-logs', async (req, res) => {
    try {
      res.json(await engine.listCheckLogs(dbPool, userIdOf(req)))
    } catch (error) {
      sendError(res, error)
    }
  })

  app.get('/api/approvals/inbox', async (req, res) => {
    try {
      res.json(await engine.listInbox(dbPool, userIdOf(req)))
    } catch (error) {
      sendError(res, error)
    }
  })

  app.get('/api/approvals/mine', async (req, res) => {
    try {
      res.json(await engine.listMine(dbPool, userIdOf(req)))
    } catch (error) {
      sendError(res, error)
    }
  })

  app.get('/api/approvals/completed', async (req, res) => {
    try {
      const range = monthRange(req.query.month)
      res.json(await engine.listCompleted(dbPool, userIdOf(req), range.from, range.to))
    } catch (error) {
      sendError(res, error)
    }
  })

  app.get('/api/approvals/cards/:id', async (req, res) => {
    try {
      res.json(await engine.getCard(dbPool, Number(req.params.id), userIdOf(req)))
    } catch (error) {
      sendError(res, error)
    }
  })

  app.post('/api/approvals/cards', async (req, res) => {
    try {
      const created = await engine.createCard(dbPool, req.body || {})
      res.status(201).json(created)
    } catch (error) {
      sendError(res, error)
    }
  })

  app.post('/api/approvals/cards/:id/author-done', async (req, res) => {
    try {
      res.json(await engine.setAuthorDone(dbPool, Number(req.params.id), userIdOf(req), Boolean(req.body?.done)))
    } catch (error) {
      sendError(res, error)
    }
  })

  app.post('/api/approvals/cards/:id/author-note', async (req, res) => {
    try {
      res.json(await engine.setAuthorNote(dbPool, Number(req.params.id), userIdOf(req), req.body?.note))
    } catch (error) {
      sendError(res, error)
    }
  })

  app.post('/api/approvals/cards/:id/links', async (req, res) => {
    try {
      res.status(201).json(await engine.linkCard(dbPool, Number(req.params.id), userIdOf(req), req.body || {}))
    } catch (error) {
      sendError(res, error)
    }
  })

  app.post('/api/approvals/marks', async (req, res) => {
    try {
      res.json(await engine.marksForTargets(dbPool, userIdOf(req), req.body?.taskIds, req.body?.globalTaskIds))
    } catch (error) {
      sendError(res, error)
    }
  })

  app.post('/api/approvals/cards/:id/cancel', async (req, res) => {
    try {
      await engine.cancelCard(dbPool, Number(req.params.id), userIdOf(req))
      res.json({ ok: true })
    } catch (error) {
      sendError(res, error)
    }
  })

  app.post('/api/approvals/cards/:id/files', (req, res) => {
    approvalUploader()(req, res, async (uploadError) => {
      if (uploadError) {
        sendError(res, Object.assign(new Error('Не удалось принять файл'), { status: 400 }))
        return
      }
      if (!req.file) {
        sendError(res, Object.assign(new Error('Выберите файл'), { status: 400 }))
        return
      }
      try {
        const saved = await engine.addFile(dbPool, Number(req.params.id), userIdOf(req), {
          fileName: req.file.originalname || req.file.filename,
          storagePath: req.file.path,
          body: req.body?.body,
        })
        res.status(201).json(saved)
      } catch (error) {
        fs.unlink(req.file.path, () => {})
        sendError(res, error)
      }
    })
  })

  app.get('/api/approvals/files/:id', async (req, res) => {
    try {
      const file = await engine.getFile(dbPool, Number(req.params.id), userIdOf(req))
      const root = path.resolve(approvalUploadsDir)
      const target = path.resolve(file.storage_path)
      const relative = path.relative(root, target)
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        sendError(res, Object.assign(new Error('Файл недоступен'), { status: 400 }))
        return
      }
      res.download(target, file.file_name)
    } catch (error) {
      sendError(res, error)
    }
  })

  app.post('/api/approvals/cards/:id/messages', async (req, res) => {
    try {
      const message = await engine.addMessage(dbPool, Number(req.params.id), userIdOf(req), req.body?.body)
      res.status(201).json(message)
    } catch (error) {
      sendError(res, error)
    }
  })

  app.post('/api/approvals/cards/:cardId/steps/:stepId/decide', async (req, res) => {
    try {
      await engine.decide(
        dbPool,
        Number(req.params.cardId),
        Number(req.params.stepId),
        userIdOf(req),
        req.body?.decision,
        req.body?.comment
      )
      res.json({ ok: true })
    } catch (error) {
      sendError(res, error)
    }
  })

  app.post('/api/approvals/cards/:cardId/steps/:stepId/check', async (req, res) => {
    try {
      await engine.manualOrCheck(
        dbPool,
        Number(req.params.cardId),
        Number(req.params.stepId),
        userIdOf(req),
        req.body?.manual ? req.body.comment || '' : null
      )
      res.json({ ok: true })
    } catch (error) {
      sendError(res, error)
    }
  })
}

async function ensureApprovalTables(dbPool) {
  const sqlPath = path.join(__dirname, '../../../db/migrations/add_approvals.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  const statements = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
  for (const statement of statements) {
    await dbPool.query(statement)
  }
}

function scheduleApprovalPoll(cron, dbPool) {
  const run = () => {
    engine.pollExternal(dbPool).catch((error) => console.error('approval cron', error.message))
  }
  const options = { timezone: 'Europe/Saratov' }
  cron.schedule('*/30 8-17 * * *', run, options)
  cron.schedule('0 18 * * *', run, options)
}

module.exports = { registerApprovalRoutes, ensureApprovalTables, scheduleApprovalPoll }
