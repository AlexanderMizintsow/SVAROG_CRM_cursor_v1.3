/**
 * Уведомления отдела о новом / обновлённом документе базы знаний.
 */

const buildMessage = ({ title, departmentName, uploaderName, isNewVersion, versionNumber }) => {
  const dept = departmentName || 'отдела'
  const who = uploaderName || 'Сотрудник'
  if (isNewVersion) {
    return [
      `В базе знаний обновлён документ «${title}» (версия ${versionNumber}).`,
      `Отдел: ${dept}.`,
      `Обновил: ${who}.`,
      'Откройте раздел «Справочники → База знаний».',
    ].join('\n')
  }
  return [
    `В базе знаний новый документ «${title}».`,
    `Отдел: ${dept}.`,
    `Загрузил: ${who}.`,
    'Откройте раздел «Справочники → База знаний».',
  ].join('\n')
}

async function getUploaderName(dbPool, userId) {
  const { rows } = await dbPool.query(
    `SELECT TRIM(CONCAT(COALESCE(last_name,''),' ',COALESCE(first_name,''),' ',COALESCE(middle_name,''))) AS name
     FROM users WHERE id = $1`,
    [userId]
  )
  return (rows[0]?.name || '').trim() || 'Сотрудник'
}

async function getDepartmentName(dbPool, departmentId) {
  const { rows } = await dbPool.query(`SELECT name FROM departments WHERE id = $1`, [
    departmentId,
  ])
  return rows[0]?.name || null
}

async function getDepartmentUserIds(dbPool, departmentId, excludeUserId) {
  const { rows } = await dbPool.query(
    `SELECT id FROM users WHERE department_id = $1 AND id <> $2`,
    [departmentId, excludeUserId]
  )
  return rows.map((r) => Number(r.id)).filter((id) => Number.isFinite(id) && id > 0)
}

/**
 * @param {object} dbPool
 * @param {object|null} io
 * @param {object} options
 */
async function notifyDepartmentAboutDocument(dbPool, io, options) {
  const {
    documentId,
    title,
    ownerDepartmentId,
    uploadedBy,
    isNewVersion = false,
    versionNumber = 1,
  } = options

  try {
    const [uploaderName, departmentName, userIds] = await Promise.all([
      getUploaderName(dbPool, uploadedBy),
      getDepartmentName(dbPool, ownerDepartmentId),
      getDepartmentUserIds(dbPool, ownerDepartmentId, uploadedBy),
    ])

    if (!userIds.length) return { notified: 0 }

    const message = buildMessage({
      title,
      departmentName,
      uploaderName,
      isNewVersion,
      versionNumber,
    })
    const eventType = isNewVersion ? 'knowledge_document_updated' : 'knowledge_document_new'

    let notified = 0
    for (const userId of userIds) {
      try {
        await dbPool.query(
          `INSERT INTO notifications (user_id, task_id, message, event_type, is_read, is_sent)
           VALUES ($1, NULL, $2, $3, FALSE, FALSE)`,
          [userId, message, eventType]
        )
        notified += 1
      } catch (error) {
        console.warn('[knowledge notify] in-app', error.message)
      }

      if (io) {
        try {
          io.emit('notification', {
            type: eventType,
            userId,
            knowledgeDocumentId: documentId,
            message,
            title,
          })
        } catch (_) {}
      }
    }

    return { notified }
  } catch (error) {
    console.warn('[knowledge notify]', error.message)
    return { notified: 0 }
  }
}

module.exports = {
  notifyDepartmentAboutDocument,
}
