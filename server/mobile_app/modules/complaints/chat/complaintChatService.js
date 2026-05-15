const path = require('path')

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const toPublicImage = (row) => ({
  id: row.id,
  fileUrl: `/uploads/${row.stored_rel_path.replace(/\\/g, '/')}`,
  mimeType: row.mime_type,
})

const ensureThreadOnWizardSubmit = async (pool, { companyId, draftId, reminderId, managerUserId }) => {
  await pool.query(
    `INSERT INTO mobile_complaint_chat_threads (company_id, draft_id, reminder_id, manager_user_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (draft_id) DO UPDATE SET
       reminder_id = COALESCE(EXCLUDED.reminder_id, mobile_complaint_chat_threads.reminder_id),
       manager_user_id = EXCLUDED.manager_user_id,
       updated_at = NOW()`,
    [companyId, draftId, reminderId, managerUserId]
  )
}

const getThreadRow = async (pool, threadId) => {
  const res = await pool.query(`SELECT * FROM mobile_complaint_chat_threads WHERE id = $1 LIMIT 1`, [threadId])
  return res.rows[0] || null
}

const getThreadByDraft = async (pool, companyId, draftId) => {
  const res = await pool.query(
    `SELECT * FROM mobile_complaint_chat_threads WHERE company_id = $1 AND draft_id = $2 LIMIT 1`,
    [companyId, draftId]
  )
  return res.rows[0] || null
}

const getThreadByReminder = async (pool, reminderId, managerUserId) => {
  const res = await pool.query(
    `SELECT t.*
       FROM mobile_complaint_chat_threads t
      WHERE t.reminder_id = $1
        AND t.manager_user_id = $2
      LIMIT 1`,
    [reminderId, managerUserId]
  )
  return res.rows[0] || null
}

const verifyReminderManager = async (pool, reminderId, managerUserId) => {
  const res = await pool.query(
    `SELECT id FROM reminders WHERE id = $1 AND user_id = $2 AND is_completed = FALSE LIMIT 1`,
    [reminderId, managerUserId]
  )
  return Boolean(res.rows[0])
}

const mapMessageRow = async (pool, messageId) => {
  const msgRes = await pool.query(
    `SELECT * FROM mobile_complaint_chat_messages WHERE id = $1 LIMIT 1`,
    [messageId]
  )
  const msg = msgRes.rows[0]
  if (!msg) return null
  const imgRes = await pool.query(
    `SELECT id, stored_rel_path, mime_type
       FROM mobile_complaint_chat_message_images
      WHERE message_id = $1
      ORDER BY sort_order ASC, id ASC`,
    [messageId]
  )
  return {
    id: msg.id,
    threadId: msg.thread_id,
    authorRole: msg.author_role,
    body: msg.body,
    createdAt: msg.created_at,
    images: imgRes.rows.map(toPublicImage),
  }
}

const listMessages = async (pool, threadId, { afterId = 0, limit = 80 } = {}) => {
  const lim = Math.min(Math.max(Number(limit) || 80, 1), 200)
  const after = Math.max(Number(afterId) || 0, 0)
  const msgRes = await pool.query(
    `SELECT id FROM mobile_complaint_chat_messages
      WHERE thread_id = $1 AND id > $2
      ORDER BY id ASC
      LIMIT $3`,
    [threadId, after, lim]
  )
  const rows = []
  for (const r of msgRes.rows) {
    // eslint-disable-next-line no-await-in-loop
    rows.push(await mapMessageRow(pool, r.id))
  }
  return rows
}

const validateImageFile = (file) => {
  const mime = String(file.mimetype || '').toLowerCase()
  if (!ALLOWED_IMAGE_MIMES.has(mime)) {
    throw new Error('allowed only image/jpeg, image/png, image/webp, image/gif')
  }
}

const createMessage = async (pool, { threadId, authorRole, companyId, managerUserId, body, files = [] }) => {
  const thread = await getThreadRow(pool, threadId)
  if (!thread) throw new Error('thread not found')
  if (thread.rejected_at) throw new Error('chat is closed')

  if (authorRole === 'dealer') {
    if (Number(thread.company_id) !== Number(companyId)) throw new Error('forbidden')
    if (!thread.opened_at) throw new Error('manager has not started the chat')
  }
  if (authorRole === 'manager') {
    if (Number(thread.manager_user_id) !== Number(managerUserId)) throw new Error('forbidden')
  }

  const text = String(body || '').trim()
  if (!text && (!files || !files.length)) {
    throw new Error('message body or image required')
  }

  for (const f of files) {
    validateImageFile(f)
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const ins = await client.query(
      `INSERT INTO mobile_complaint_chat_messages (thread_id, author_role, body)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [threadId, authorRole, text]
    )
    const messageId = ins.rows[0].id

    if (authorRole === 'manager' && !thread.opened_at) {
      await client.query(
        `UPDATE mobile_complaint_chat_threads SET opened_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [threadId]
      )
    }

    const uploadsRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', 'uploads')
    let sort = 0
    for (const file of files) {
      const relPath = path.relative(uploadsRoot, file.path)
      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `INSERT INTO mobile_complaint_chat_message_images
          (message_id, stored_rel_path, mime_type, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [messageId, relPath, String(file.mimetype || '').toLowerCase(), sort]
      )
      sort += 1
    }

    await client.query(
      `UPDATE mobile_complaint_chat_threads SET updated_at = NOW() WHERE id = $1`,
      [threadId]
    )
    await client.query('COMMIT')
    return mapMessageRow(pool, messageId)
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

const rejectThreadByReminder = async (pool, { reminderId, managerUserId, reason }) => {
  const r = String(reason || '').trim()
  if (!r) throw new Error('rejection reason required')

  const ok = await verifyReminderManager(pool, reminderId, managerUserId)
  if (!ok) throw new Error('reminder not found or access denied')

  const thread = await getThreadByReminder(pool, reminderId, managerUserId)
  if (!thread) throw new Error('chat thread not found')

  await pool.query(
    `UPDATE mobile_complaint_chat_threads
        SET rejected_at = NOW(),
            rejection_reason = $1,
            rejected_by_manager_id = $2,
            updated_at = NOW()
      WHERE id = $3
        AND rejected_at IS NULL`,
    [r, managerUserId, thread.id]
  )

  await pool.query(
    `UPDATE reminders
        SET is_completed = TRUE,
            completed_at = NOW()
      WHERE id = $1
        AND user_id = $2`,
    [reminderId, managerUserId]
  )

  return { threadId: thread.id, draftId: thread.draft_id, companyId: thread.company_id }
}

const threadMetaForDealer = async (pool, companyId, draftId) => {
  const thread = await getThreadByDraft(pool, companyId, draftId)
  if (!thread) return null
  return {
    threadId: thread.id,
    draftId: thread.draft_id,
    openedAt: thread.opened_at,
    rejectedAt: thread.rejected_at,
    rejectionReason: thread.rejection_reason,
    canWrite: Boolean(thread.opened_at) && !thread.rejected_at,
  }
}

const threadMetaForManager = async (pool, reminderId, managerUserId) => {
  const thread = await getThreadByReminder(pool, reminderId, managerUserId)
  if (!thread) return null
  return {
    threadId: thread.id,
    draftId: thread.draft_id,
    reminderId: thread.reminder_id,
    openedAt: thread.opened_at,
    rejectedAt: thread.rejected_at,
    rejectionReason: thread.rejection_reason,
    canWrite: !thread.rejected_at,
  }
}

module.exports = {
  ensureThreadOnWizardSubmit,
  getThreadByDraft,
  getThreadByReminder,
  getThreadRow,
  listMessages,
  createMessage,
  rejectThreadByReminder,
  threadMetaForDealer,
  threadMetaForManager,
  verifyReminderManager,
  mapMessageRow,
  ALLOWED_IMAGE_MIMES,
}
