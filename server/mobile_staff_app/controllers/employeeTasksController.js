const FormData = require('form-data')
const { registerFetch, REGISTER_URL } = require('../services/registerClient')
const pool = require('../db/pool')
const {
  STATUS_LABELS,
  getTaskMeta,
  notifyTaskParticipants,
  safeNotify,
  uniqueUserIds,
} = require('../services/staffNotifyHelpers')

/**
 * ПРИ СОЗДАНИИ НОВЫХ СОБЫТИЙ: после успешной мутации вызывайте
 * notifyTaskParticipants / notifyProjectParticipants (staffNotifyHelpers).
 */

const formatUserName = (u) => {
  if (!u) return '—'
  const parts = [u.last_name, u.first_name, u.middle_name].filter(Boolean)
  return parts.length ? parts.join(' ') : u.username || `ID ${u.id}`
}

const attachmentFilename = (fileUrl) => {
  if (!fileUrl) return null
  try {
    const cleaned = String(fileUrl).split('?')[0]
    const parts = cleaned.split('/')
    return parts[parts.length - 1] || null
  } catch {
    return null
  }
}

const mapAttachments = (attachments) => {
  if (!Array.isArray(attachments)) return []
  return attachments
    .filter(Boolean)
    .map((file) => {
      const filename = attachmentFilename(file.file_url)
      return {
        ...file,
        filename,
        // Относительный путь к прокси mobile_staff_app (клиент добавит base + token)
        open_path: filename
          ? `/api/mobile/employee/tasks/files/${encodeURIComponent(filename)}`
          : null,
      }
    })
}

const buildUsersMap = async () => {
  const users = await registerFetch('/api/users')
  const map = {}
  ;(users || []).forEach((u) => {
    map[String(u.id)] = formatUserName(u)
  })
  return map
}

const enrichTask = (task, usersMap, currentUserId) => {
  const assigned = Array.isArray(task.assigned_user_ids) ? task.assigned_user_ids : []
  const approvers = Array.isArray(task.approver_user_ids) ? task.approver_user_ids : []
  const viewers = Array.isArray(task.visibility_user_ids) ? task.visibility_user_ids : []
  const authorId = task.created_by
  const roles = []

  if (assigned.map(String).includes(String(currentUserId))) roles.push('assigned')
  if (String(authorId) === String(currentUserId)) roles.push('created')
  if (
    approvers.some(
      (a) => String(a.approver_id || a) === String(currentUserId)
    )
  ) {
    roles.push('approver')
  }
  if (viewers.map(String).includes(String(currentUserId))) roles.push('watching')

  const primaryAssigneeId = assigned[0] || null

  return {
    id: String(task.task_id || task.id),
    task_id: task.task_id || task.id,
    title: task.title,
    description: task.description || '',
    status: task.status || 'backlog',
    priority: task.priority || 'medium',
    deadline: task.deadline || null,
    tags: Array.isArray(task.tags) ? task.tags : [],
    global_task_id: task.global_task_id || null,
    parent_id: task.parent_id || null,
    root_id: task.root_id || null,
    created_by: authorId,
    created_at: task.created_at,
    completed_at: task.completed_at,
    done_moved_at: task.done_moved_at,
    isCompleted: Boolean(task.is_completed),
    awaitingDecision:
      task.status === 'done' &&
      !Boolean(task.is_completed) &&
      String(authorId) === String(currentUserId),
    assigned_user_ids: assigned,
    approver_user_ids: approvers,
    visibility_user_ids: viewers,
    attachments: mapAttachments(task.attachments),
    comments_redo: Array.isArray(task.comments_redo) ? task.comments_redo : [],
    hasAttachments: Array.isArray(task.attachments) && task.attachments.length > 0,
    authorName: usersMap[String(authorId)] || `ID ${authorId}`,
    assigneeName: primaryAssigneeId
      ? usersMap[String(primaryAssigneeId)] || `ID ${primaryAssigneeId}`
      : 'Не назначен',
    roles,
    projectTitle: null,
  }
}

const filterByScope = (tasks, scope, currentUserId) => {
  if (scope === 'archive') {
    return tasks.filter((t) => t.isCompleted)
  }
  return tasks.filter((t) => {
    if (t.isCompleted) return false
    if (scope === 'assigned') return t.roles.includes('assigned')
    if (scope === 'created') return t.roles.includes('created')
    if (scope === 'approver') return t.roles.includes('approver')
    if (scope === 'watching') return t.roles.includes('watching')
    return true
  })
}

const listTasks = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const scope = String(req.query.scope || 'assigned')
    const usersMap = await buildUsersMap()

    let raw = []
    if (scope === 'archive') {
      raw = await registerFetch(
        `/api/tasks/user/${userId}?filter=completed_tasks`
      )
    } else if (scope === 'assigned') {
      raw = await registerFetch(
        `/api/tasks/user/${userId}?filter=my_tasks&is_completed=false`
      )
    } else {
      raw = await registerFetch(
        `/api/tasks/user/${userId}?filter=tasks_manager&is_completed=false`
      )
    }

    const enriched = (raw || []).map((t) =>
      enrichTask(
        {
          ...t,
          is_completed:
            scope === 'archive'
              ? true
              : t.is_completed != null
                ? t.is_completed
                : Boolean(t.completed_at),
        },
        usersMap,
        userId
      )
    )
    const filtered = filterByScope(enriched, scope, userId)

    // Подтянуть названия проектов пакетно
    const projectIds = [
      ...new Set(filtered.map((t) => t.global_task_id).filter(Boolean)),
    ]
    const titleByProject = {}
    await Promise.all(
      projectIds.map(async (pid) => {
        try {
          const row = await registerFetch(`/api/global-tasks/${pid}/title`)
          titleByProject[String(pid)] =
            typeof row === 'string' ? row : row?.title || null
        } catch {
          titleByProject[String(pid)] = null
        }
      })
    )

    const withProjects = filtered.map((t) => ({
      ...t,
      projectTitle: t.global_task_id
        ? titleByProject[String(t.global_task_id)]
        : null,
    }))

    return res.json({ tasks: withProjects })
  } catch (error) {
    console.error('[mobile_staff_app][tasks][list]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка загрузки задач' })
  }
}

const getTask = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const taskId = req.params.taskId
    const usersMap = await buildUsersMap()

    // Берём обогащённую задачу из обоих списков (исполнитель + менеджер)
    const [mine, managed, completed] = await Promise.all([
      registerFetch(`/api/tasks/user/${userId}?filter=my_tasks&is_completed=false`).catch(() => []),
      registerFetch(`/api/tasks/user/${userId}?filter=tasks_manager&is_completed=false`).catch(() => []),
      registerFetch(`/api/tasks/user/${userId}?filter=completed_tasks`).catch(() => []),
    ])
    const all = [...(mine || []), ...(managed || []), ...(completed || [])]
    const found = all.find((t) => String(t.task_id) === String(taskId))
    if (!found) {
      const raw = await registerFetch(`/api/tasks/${taskId}`)
      const enriched = enrichTask(
        { ...raw, task_id: raw.id, is_completed: raw.is_completed },
        usersMap,
        userId
      )
      if (enriched.global_task_id) {
        try {
          const title = await registerFetch(
            `/api/global-tasks/${enriched.global_task_id}/title`
          )
          enriched.projectTitle =
            typeof title === 'string' ? title : title?.title || null
        } catch {}
      }
      return res.json({ task: enriched })
    }

    const fromArchive = (completed || []).some(
      (t) => String(t.task_id) === String(taskId)
    )
    const enriched = enrichTask(
      {
        ...found,
        is_completed:
          found.is_completed != null
            ? found.is_completed
            : fromArchive || Boolean(found.completed_at),
      },
      usersMap,
      userId
    )
    if (enriched.global_task_id) {
      try {
        const title = await registerFetch(
          `/api/global-tasks/${enriched.global_task_id}/title`
        )
        enriched.projectTitle =
          typeof title === 'string' ? title : title?.title || null
      } catch {}
    }
    return res.json({ task: enriched })
  } catch (error) {
    console.error('[mobile_staff_app][tasks][get]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка загрузки задачи' })
  }
}

const createTask = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const {
      title,
      description,
      deadline,
      priority = 'medium',
      tags = [],
      assigneeId,
      approverIds = [],
      viewerIds = [],
      parent_id = null,
      root_id = null,
      global_task_id = null,
    } = req.body || {}

    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: 'Укажите название задачи' })
    }
    if (!description || !String(description).replace(/<[^>]+>/g, '').trim()) {
      return res.status(400).json({ message: 'Укажите описание задачи' })
    }
    if (!assigneeId) {
      return res.status(400).json({ message: 'Укажите исполнителя' })
    }

    const users = await registerFetch('/api/users').catch(() => [])
    const assignee = (users || []).find((u) => Number(u.id) === Number(assigneeId))
    if (assignee && String(assignee.role_name || '').trim() === 'Директор') {
      return res.status(422).json({
        message:
          'Пользователя с ролью «Директор» нельзя назначить исполнителем задачи. Используйте обращение к руководителю.',
      })
    }

    const created = await registerFetch('/api/tasks/create', {
      method: 'POST',
      body: {
        title: String(title).trim(),
        description,
        created_by: userId,
        deadline: deadline || '',
        priority,
        tags: Array.isArray(tags) ? tags : [],
        status: 'backlog',
        parent_id: parent_id != null ? Number(parent_id) : null,
        root_id: root_id != null ? Number(root_id) : parent_id != null ? Number(parent_id) : null,
        global_task_id: global_task_id != null ? Number(global_task_id) : null,
      },
    })

    const taskId = created.id
    await registerFetch('/api/tasks/assignment/add', {
      method: 'POST',
      body: { task_id: taskId, user_id: Number(assigneeId) },
    })

    for (const approverId of approverIds || []) {
      await registerFetch('/api/tasks/approval/add', {
        method: 'POST',
        body: { task_id: taskId, approver_id: Number(approverId) },
      })
    }
    for (const viewerId of viewerIds || []) {
      await registerFetch('/api/tasks/visibility/add', {
        method: 'POST',
        body: { task_id: taskId, user_id: Number(viewerId) },
      })
    }

    await registerFetch('/api/tasks/socket', {
      method: 'POST',
      body: {
        id: taskId,
        createdBy: userId,
        assignedUsers: [Number(assigneeId)],
        approvers: (approverIds || []).map(Number),
        viewers: (viewerIds || []).map(Number),
      },
    }).catch(() => null)

    return res.status(201).json({ taskId, task: created })
  } catch (error) {
    console.error('[mobile_staff_app][tasks][create]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка создания задачи' })
  }
}

const updateStatus = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const taskId = req.params.taskId
    const { status } = req.body || {}
    if (!status) return res.status(400).json({ message: 'Статус обязателен' })

    // Проверка: исполнитель задачи
    const mine = await registerFetch(
      `/api/tasks/user/${userId}?filter=my_tasks&is_completed=false`
    )
    const allowed = (mine || []).some((t) => String(t.task_id) === String(taskId))
    if (!allowed) {
      return res.status(403).json({ message: 'Менять статус может только исполнитель' })
    }

    const updated = await registerFetch(`/api/tasks/${taskId}/status`, {
      method: 'PUT',
      body: { status },
    })

    const meta = await getTaskMeta(pool, taskId).catch(() => null)
    const statusLabel = STATUS_LABELS[status] || status
    notifyTaskParticipants(pool, {
      taskId,
      excludeUserId: userId,
      title: 'Статус задачи',
      body: `${meta?.title || 'Задача'}: ${statusLabel}`,
      type: 'task_status',
    })

    return res.json({ task: updated })
  } catch (error) {
    console.error('[mobile_staff_app][tasks][status]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка смены статуса' })
  }
}

const decideTask = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const taskId = req.params.taskId
    const { accept, comment } = req.body || {}
    const isDone = accept === true || accept === 'true'

    const updated = await registerFetch(
      `/api/task/accept/${taskId}/${userId}/${isDone}`,
      {
        method: 'PATCH',
        body: !isDone && comment ? { comment } : {},
      }
    )

    const meta = await getTaskMeta(pool, taskId).catch(() => null)
    notifyTaskParticipants(pool, {
      taskId,
      excludeUserId: userId,
      userIds: meta?.assigneeIds || [],
      title: isDone ? 'Задача принята' : 'Задача возвращена',
      body: meta?.title || `Задача #${taskId}`,
      type: isDone ? 'task_decision_accept' : 'task_decision_return',
    })

    return res.json({ result: updated })
  } catch (error) {
    console.error('[mobile_staff_app][tasks][decide]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка решения по задаче' })
  }
}

const getMessages = () => async (req, res) => {
  try {
    const taskId = req.params.taskId
    const messages = await registerFetch(
      `/api/tasks/${taskId}/messages-chat-task`
    )
    return res.json({ messages: messages || [] })
  } catch (error) {
    console.error('[mobile_staff_app][tasks][messages]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка загрузки чата' })
  }
}

const sendMessage = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const taskId = req.params.taskId
    const { text, taskAuthorId, title, repliedToMessageId } = req.body || {}
    if (!text || !String(text).trim()) {
      return res.status(400).json({ message: 'Текст сообщения обязателен' })
    }

    const message = await registerFetch(
      `/api/tasks/${taskId}/messages-chat-task`,
      {
        method: 'POST',
        body: {
          senderId: userId,
          text: String(text).trim(),
          taskAuthorId,
          title: title || 'Задача',
          repliedToMessageId: repliedToMessageId || null,
        },
      }
    )

    const preview = String(text).trim().slice(0, 120)
    notifyTaskParticipants(pool, {
      taskId,
      excludeUserId: userId,
      title: 'Сообщение в задаче',
      body: `${title || 'Задача'}: ${preview}`,
      type: 'task_message',
    })

    return res.status(201).json({ message })
  } catch (error) {
    console.error('[mobile_staff_app][tasks][sendMessage]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка отправки сообщения' })
  }
}

const updateMessage = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const { taskId, messageId } = req.params
    const { text } = req.body || {}
    if (!text || !String(text).trim()) {
      return res.status(400).json({ message: 'Текст сообщения обязателен' })
    }

    const message = await registerFetch(
      `/api/tasks/${taskId}/messages-chat-task/${messageId}`,
      {
        method: 'PATCH',
        body: {
          senderId: userId,
          text: String(text).trim(),
        },
      }
    )

    return res.json({ message })
  } catch (error) {
    console.error('[mobile_staff_app][tasks][updateMessage]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка редактирования сообщения' })
  }
}

const deleteMessage = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const { taskId, messageId } = req.params

    const message = await registerFetch(
      `/api/tasks/${taskId}/messages-chat-task/${messageId}?senderId=${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        body: { senderId: userId },
      }
    )

    return res.json({ message })
  } catch (error) {
    console.error('[mobile_staff_app][tasks][deleteMessage]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка удаления сообщения' })
  }
}

const updateDescription = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const taskId = req.params.taskId
    const { description, assigned_user_ids } = req.body || {}
    const updated = await registerFetch(`/api/tasks/editing/description/${taskId}`, {
      method: 'PUT',
      body: {
        newDescription: description,
        assignedUserIds: assigned_user_ids || [],
      },
    })
    const meta = await getTaskMeta(pool, taskId).catch(() => null)
    notifyTaskParticipants(pool, {
      taskId,
      excludeUserId: userId,
      userIds: assigned_user_ids?.length
        ? assigned_user_ids
        : meta?.assigneeIds,
      title: 'Изменено описание',
      body: meta?.title || `Задача #${taskId}`,
      type: 'task_description',
    })
    return res.json({ result: updated })
  } catch (error) {
    console.error('[mobile_staff_app][tasks][description]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка обновления описания' })
  }
}

const updateDeadline = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const taskId = req.params.taskId
    const { new_deadline, response_comment, assigned_user_ids } = req.body || {}
    const updated = await registerFetch(`/api/tasks/${taskId}/deadline`, {
      method: 'PATCH',
      body: {
        responder_id: userId,
        new_deadline,
        response_comment: response_comment || null,
        assigned_user_ids: assigned_user_ids || [],
      },
    })
    // push: register task_deadline_updated
    return res.json({ result: updated })
  } catch (error) {
    console.error('[mobile_staff_app][tasks][deadline]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка обновления срока' })
  }
}

const requestExtension = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const { task_id, created_by, reason, new_proposed_deadline } = req.body || {}
    const result = await registerFetch('/api/tasks/extension-request', {
      method: 'POST',
      body: {
        task_id,
        requester_id: userId,
        created_by,
        reason,
        new_proposed_deadline,
      },
    })
    const meta = await getTaskMeta(pool, task_id).catch(() => null)
    const authorId = Number(created_by || meta?.createdBy)
    if (authorId) {
      safeNotify(pool, {
        userIds: uniqueUserIds([authorId], userId),
        title: 'Запрос продления срока',
        body: meta?.title || `Задача #${task_id}`,
        data: { type: 'task_extension_request', taskId: Number(task_id) },
      })
    }
    return res.status(201).json(result)
  } catch (error) {
    console.error('[mobile_staff_app][tasks][extension]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка запроса продления' })
  }
}

const replaceAssignee = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const taskId = req.params.taskId
    const { old_user_id, new_user_id } = req.body || {}
    const result = await registerFetch(`/api/tasks/${taskId}/replace-assignee`, {
      method: 'PUT',
      body: { task_id: Number(taskId), old_user_id, new_user_id },
    })
    // push: register taskAssigneeChanged
    return res.json(result)
  } catch (error) {
    console.error('[mobile_staff_app][tasks][replace]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка смены исполнителя' })
  }
}

const listUsers = () => async (req, res) => {
  try {
    const users = await registerFetch('/api/users')
    const mapped = (users || []).map((u) => ({
      id: u.id,
      name: formatUserName(u),
      username: u.username,
      department_id: u.department_id || null,
      roleName: u.role_name || null,
      isDirector: String(u.role_name || '').trim() === 'Директор',
    }))
    return res.json({ users: mapped })
  } catch (error) {
    console.error('[mobile_staff_app][tasks][users]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка загрузки пользователей' })
  }
}

const proxyFile = () => async (req, res) => {
  try {
    const filename = String(req.params.filename || '').replace(/[\\/]/g, '')
    if (!filename) {
      return res.status(400).json({ message: 'Имя файла обязательно' })
    }
    const upstream = await fetch(
      `${REGISTER_URL}/api/task/uploads/${encodeURIComponent(filename)}`
    )
    if (!upstream.ok) {
      return res
        .status(upstream.status)
        .json({ message: 'Файл не найден на сервере CRM' })
    }
    const contentType =
      upstream.headers.get('content-type') || 'application/octet-stream'
    const buffer = Buffer.from(await upstream.arrayBuffer())
    res.setHeader('Content-Type', contentType)
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(filename)}"`
    )
    return res.send(buffer)
  } catch (error) {
    console.error('[mobile_staff_app][tasks][proxyFile]', error)
    return res.status(500).json({ message: 'Ошибка получения файла' })
  }
}

const addAttachment = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const taskId = Number(req.params.taskId)
    const file = req.file
    if (!file) {
      return res.status(400).json({ message: 'Файл не передан' })
    }
    if (!taskId) {
      return res.status(400).json({ message: 'taskId обязателен' })
    }

    const form = new FormData()
    form.append('files', file.buffer, {
      filename: file.originalname || file.filename || 'file',
      contentType: file.mimetype || 'application/octet-stream',
    })

    const uploadResponse = await fetch(`${REGISTER_URL}/api/upload`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    })
    const uploadText = await uploadResponse.text()
    let uploadData = null
    try {
      uploadData = uploadText ? JSON.parse(uploadText) : null
    } catch {
      uploadData = null
    }
    if (!uploadResponse.ok) {
      return res.status(uploadResponse.status).json({
        message:
          (uploadData && (uploadData.error || uploadData.message)) ||
          'Ошибка загрузки файла',
      })
    }

    const fileUrl = uploadData?.fileUrls?.[0]
    if (!fileUrl) {
      return res.status(500).json({ message: 'Сервер не вернул URL файла' })
    }

    const attachment = await registerFetch('/api/tasks/attachment/add', {
      method: 'POST',
      body: {
        task_id: taskId,
        file_url: fileUrl,
        file_type: file.mimetype || 'application/octet-stream',
        comment_file: req.body?.comment || '',
        name_file: file.originalname || 'file',
        uploaded_by: userId,
        tableType: 'local',
      },
    })

    const meta = await getTaskMeta(pool, taskId).catch(() => null)
    notifyTaskParticipants(pool, {
      taskId,
      excludeUserId: userId,
      title: 'Вложение в задаче',
      body: `${meta?.title || 'Задача'}: ${file.originalname || 'файл'}`,
      type: 'task_attachment',
    })

    return res.status(201).json({
      attachment: {
        ...attachment,
        file_url: fileUrl,
        name_file: file.originalname || 'file',
        open_path: `/api/mobile/employee/tasks/files/${encodeURIComponent(
          attachmentFilename(fileUrl)
        )}`,
      },
    })
  } catch (error) {
    console.error('[mobile_staff_app][tasks][addAttachment]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка добавления вложения' })
  }
}

const listPendingExtensions = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const rows = await registerFetch(
      `/api/tasks/extension-requests/pending/${userId}`
    )
    return res.json({ requests: rows || [] })
  } catch (error) {
    console.error('[mobile_staff_app][tasks][extensions]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка загрузки запросов продления' })
  }
}

const approveExtension = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const { requestId } = req.params
    const { response_comment, new_deadline } = req.body || {}

    const result = await registerFetch(
      `/api/tasks/extension-requests/${requestId}/approve`,
      {
        method: 'PATCH',
        body: {
          responder_id: userId,
          response_comment: response_comment || null,
          new_deadline,
        },
      }
    )

    // push: register extension_request_approved
    return res.json(result)
  } catch (error) {
    console.error('[mobile_staff_app][tasks][approveExtension]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка утверждения продления' })
  }
}

const rejectExtension = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const { requestId } = req.params
    const { response_comment } = req.body || {}

    const result = await registerFetch(
      `/api/tasks/extension-requests/${requestId}/reject`,
      {
        method: 'PATCH',
        body: {
          responder_id: userId,
          response_comment: response_comment || null,
        },
      }
    )

    // push: register extension_request_rejected
    return res.json(result)
  } catch (error) {
    console.error('[mobile_staff_app][tasks][rejectExtension]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка отклонения продления' })
  }
}

const getHierarchy = () => async (req, res) => {
  try {
    const taskId = req.params.taskId
    const rows = await registerFetch(`/api/tasks/hierarchy/${taskId}`)
    return res.json({ hierarchy: Array.isArray(rows) ? rows : [] })
  } catch (error) {
    console.error('[mobile_staff_app][tasks][hierarchy]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка загрузки иерархии' })
  }
}

const getHasSubtasks = () => async (req, res) => {
  try {
    const taskId = req.params.taskId
    const data = await registerFetch(`/api/tasks/${taskId}/has-subtasks`)
    return res.json(data || { has_subtasks: false, all_completed: false })
  } catch (error) {
    console.error('[mobile_staff_app][tasks][hasSubtasks]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка проверки подзадач' })
  }
}

module.exports = {
  listTasks,
  getTask,
  createTask,
  updateStatus,
  decideTask,
  getMessages,
  sendMessage,
  updateMessage,
  deleteMessage,
  updateDescription,
  updateDeadline,
  requestExtension,
  replaceAssignee,
  listUsers,
  proxyFile,
  addAttachment,
  listPendingExtensions,
  approveExtension,
  rejectExtension,
  getHierarchy,
  getHasSubtasks,
}
