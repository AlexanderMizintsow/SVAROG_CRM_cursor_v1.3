const FormData = require('form-data')
const { registerFetch, REGISTER_URL } = require('../services/registerClient')
const pool = require('../db/pool')
const {
  getProjectMeta,
  notifyProjectParticipants,
  safeNotify,
  uniqueUserIds,
} = require('../services/staffNotifyHelpers')

const TERMINAL = ['Завершено', 'Провал', 'Удален']

const attachmentFilename = (fileUrl) => {
  if (!fileUrl) return null
  const cleaned = String(fileUrl).split('?')[0]
  const parts = cleaned.split('/')
  return parts[parts.length - 1] || null
}

const mapAttachments = (attachments) => {
  if (!Array.isArray(attachments)) return []
  return attachments.filter(Boolean).map((file) => {
    const filename = attachmentFilename(file.file_url)
    return {
      ...file,
      filename,
      open_path: filename
        ? `/api/mobile/employee/tasks/files/${encodeURIComponent(filename)}`
        : null,
    }
  })
}

const enrichProject = (project, currentUserId) => {
  const authorId =
    project.created_by && typeof project.created_by === 'object'
      ? project.created_by.id
      : project.created_by
  const authorName =
    project.created_by && typeof project.created_by === 'object'
      ? project.created_by.name
      : null
  const responsibles = Array.isArray(project.responsibles) ? project.responsibles : []
  const isAuthor = String(authorId) === String(currentUserId)
  const myResponsible = responsibles.find((r) => String(r.id) === String(currentUserId))
  const needsMyApproval =
    Boolean(myResponsible?.requires_approval) &&
    (!myResponsible.approval_status || myResponsible.approval_status === 'pending')
  const isTerminal = TERMINAL.includes(project.status)

  return {
    id: String(project.id),
    title: project.title,
    description: project.description || '',
    goals: Array.isArray(project.goals) ? project.goals : [],
    additional_info:
      project.additional_info && typeof project.additional_info === 'object'
        ? project.additional_info
        : {},
    deadline: project.deadline || null,
    priority: project.priority || 'medium',
    status: project.status || 'Новая',
    progress: project.progress || 0,
    completion_percentage: Number(project.completion_percentage) || 0,
    created_at: project.created_at,
    created_by: authorId,
    authorName: authorName || `ID ${authorId}`,
    responsibles,
    isAuthor,
    isParticipant: isAuthor || Boolean(myResponsible),
    needsMyApproval,
    isTerminal,
    myResponsible,
    user_tasks_count: Number(project.user_tasks_count) || 0,
    user_task_titles: Array.isArray(project.user_task_titles)
      ? project.user_task_titles
      : [],
  }
}

const listProjects = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const scope = String(req.query.scope || 'active')
    const type = String(req.query.type || 'all')

    let raw = []
    if (scope === 'archive' || scope === 'completed') {
      raw = await registerFetch(
        `/api/global-tasks-completed?userId=${userId}&type=${encodeURIComponent(type)}`
      )
    } else {
      raw = await registerFetch(`/api/global-tasks-all?userId=${userId}`)
    }

    const projects = (Array.isArray(raw) ? raw : []).map((p) =>
      enrichProject(p, userId)
    )
    return res.json({ projects })
  } catch (error) {
    console.error('[mobile_staff_app][projects][list]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка загрузки проектов' })
  }
}

const getProject = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const projectId = req.params.projectId
    const raw = await registerFetch(`/api/global-tasks/${projectId}`)
    const project = enrichProject(raw, userId)

    const [subtasks, attachments, history] = await Promise.all([
      registerFetch(`/api/tasks/subtasks/${projectId}`).catch(() => []),
      registerFetch(`/api/tasks/${projectId}/attachments`)
        .then((d) => (d && d.attachments) || [])
        .catch(() => []),
      registerFetch(`/api/global-task/${projectId}/history`).catch(() => []),
    ])

    return res.json({
      project: {
        ...project,
        attachments: mapAttachments(attachments),
        subtasks: Array.isArray(subtasks) ? subtasks : [],
        history: Array.isArray(history) ? history : [],
      },
    })
  } catch (error) {
    console.error('[mobile_staff_app][projects][get]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка загрузки проекта' })
  }
}

const createProject = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const {
      title,
      description = '',
      goals = [],
      deadline = null,
      priority = 'medium',
      additionalInfo = {},
      responsibles = [],
    } = req.body || {}

    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: 'Укажите название проекта' })
    }

    const created = await registerFetch('/api/create/global-tasks', {
      method: 'POST',
      body: {
        title: String(title).trim(),
        description,
        goals: Array.isArray(goals) ? goals.filter((g) => String(g || '').trim()) : [],
        deadline: deadline || null,
        priority,
        additionalInfo:
          additionalInfo && typeof additionalInfo === 'object' ? additionalInfo : {},
        responsibles: Array.isArray(responsibles)
          ? responsibles.map((r) => ({
              id: Number(r.id),
              role: r.role || 'Участник',
              requires_approval: Boolean(r.requires_approval),
            }))
          : [],
        created_by: userId,
      },
    })

    const projectId = created?.taskId || created?.id
    // push: register emitGlobalTaskChanged(created)

    return res.status(201).json({
      projectId,
      result: created,
    })
  } catch (error) {
    console.error('[mobile_staff_app][projects][create]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка создания проекта' })
  }
}

const updateStatus = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const projectId = req.params.projectId
    const { status, comment } = req.body || {}
    if (!status) {
      return res.status(400).json({ message: 'Статус обязателен' })
    }

    const project = await registerFetch(`/api/global-tasks/${projectId}`)
    const authorId =
      project.created_by && typeof project.created_by === 'object'
        ? project.created_by.id
        : project.created_by
    if (String(authorId) !== String(userId)) {
      return res.status(403).json({ message: 'Статус может менять только автор проекта' })
    }

    if (comment && String(comment).trim()) {
      await registerFetch(`/api/global-tasks/${projectId}/comments`, {
        method: 'POST',
        body: { user_id: userId, comment: String(comment).trim() },
      }).catch(() => null)
    }

    if (status === 'Удален') {
      const result = await registerFetch(`/api/global-tasks/delete/${projectId}`, {
        method: 'DELETE',
        body: { userId },
      })
      // push: register emitGlobalTaskChanged(deleted)
      return res.json({ result })
    }

    const result = await registerFetch(`/api/update/global-tasks/${projectId}/status`, {
      method: 'PUT',
      body: { status, userId },
    })
    // push: register emitGlobalTaskChanged(status)
    return res.json({ result })
  } catch (error) {
    console.error('[mobile_staff_app][projects][status]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка смены статуса' })
  }
}

const setApproval = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const projectId = req.params.projectId
    const { status, comment } = req.body || {}
    const result = await registerFetch(`/api/global-tasks/${projectId}/approval`, {
      method: 'POST',
      body: { status, comment, userId },
    })
    const meta = await getProjectMeta(pool, projectId).catch(() => null)
    if (meta?.createdBy) {
      safeNotify(pool, {
        userIds: uniqueUserIds([meta.createdBy], userId),
        title: status === 'approved' || status === true ? 'Проект согласован' : 'Согласование проекта',
        body: meta.title || `Проект #${projectId}`,
        data: { type: 'project_approval', projectId: Number(projectId) },
      })
    }
    return res.json(result)
  } catch (error) {
    console.error('[mobile_staff_app][projects][approval]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка согласования' })
  }
}

const getMessages = () => async (req, res) => {
  try {
    const projectId = req.params.projectId
    const messages = await registerFetch(`/api/global-tasks/chat/${projectId}`)
    return res.json({ messages: Array.isArray(messages) ? messages : [] })
  } catch (error) {
    console.error('[mobile_staff_app][projects][messages]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка загрузки чата' })
  }
}

const sendMessage = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const projectId = req.params.projectId
    const { text, title, repliedToMessageId } = req.body || {}
    if (!text || !String(text).trim()) {
      return res.status(400).json({ message: 'Текст сообщения обязателен' })
    }
    const message = await registerFetch('/api/global-tasks/chat', {
      method: 'POST',
      body: {
        globalTaskId: Number(projectId),
        userId,
        text: String(text).trim(),
        title: title || 'Проект',
        repliedToMessageId: repliedToMessageId || null,
      },
    })
    const preview = String(text).trim().slice(0, 120)
    notifyProjectParticipants(pool, {
      projectId,
      excludeUserId: userId,
      title: 'Сообщение в проекте',
      body: `${title || 'Проект'}: ${preview}`,
      type: 'project_message',
    })
    return res.status(201).json({ message })
  } catch (error) {
    console.error('[mobile_staff_app][projects][sendMessage]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка отправки сообщения' })
  }
}

const updateMessage = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const { projectId, messageId } = req.params
    const { text } = req.body || {}
    if (!text || !String(text).trim()) {
      return res.status(400).json({ message: 'Текст сообщения обязателен' })
    }

    const message = await registerFetch(
      `/api/global-tasks/chat/${projectId}/${messageId}`,
      {
        method: 'PATCH',
        body: {
          userId,
          text: String(text).trim(),
        },
      }
    )

    return res.json({ message })
  } catch (error) {
    console.error('[mobile_staff_app][projects][updateMessage]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка редактирования сообщения' })
  }
}

const deleteMessage = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const { projectId, messageId } = req.params

    const message = await registerFetch(
      `/api/global-tasks/chat/${projectId}/${messageId}?userId=${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        body: { userId },
      }
    )

    return res.json({ message })
  } catch (error) {
    console.error('[mobile_staff_app][projects][deleteMessage]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка удаления сообщения' })
  }
}

const addAttachment = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const projectId = Number(req.params.projectId)
    const file = req.file
    if (!file) return res.status(400).json({ message: 'Файл не передан' })
    if (!projectId) return res.status(400).json({ message: 'projectId обязателен' })

    const form = new FormData()
    form.append('files', file.buffer, {
      filename: file.originalname || 'file',
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
        task_id: projectId,
        file_url: fileUrl,
        file_type: file.mimetype || 'application/octet-stream',
        comment_file: req.body?.comment || '',
        name_file: file.originalname || 'file',
        uploaded_by: userId,
        tableType: 'global',
      },
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
    console.error('[mobile_staff_app][projects][addAttachment]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка добавления вложения' })
  }
}

const getHistory = () => async (req, res) => {
  try {
    const projectId = req.params.projectId
    const history = await registerFetch(`/api/global-task/${projectId}/history`)
    return res.json({ history: Array.isArray(history) ? history : [] })
  } catch (error) {
    console.error('[mobile_staff_app][projects][history]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка загрузки истории' })
  }
}

const getSubtasks = () => async (req, res) => {
  try {
    const projectId = req.params.projectId
    const subtasks = await registerFetch(`/api/tasks/subtasks/${projectId}`)
    return res.json({ subtasks: Array.isArray(subtasks) ? subtasks : [] })
  } catch (error) {
    console.error('[mobile_staff_app][projects][subtasks]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка загрузки подзадач' })
  }
}

const assertAuthor = async (projectId, userId) => {
  const project = await registerFetch(`/api/global-tasks/${projectId}`)
  const authorId =
    project.created_by && typeof project.created_by === 'object'
      ? project.created_by.id
      : project.created_by
  if (String(authorId) !== String(userId)) {
    const err = new Error('Менять проект может только автор')
    err.status = 403
    throw err
  }
  if (TERMINAL.includes(project.status)) {
    const err = new Error('Проект закрыт для изменений')
    err.status = 400
    throw err
  }
  return project
}

const updateDescription = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const projectId = req.params.projectId
    const { description } = req.body || {}
    await assertAuthor(projectId, userId)
    const result = await registerFetch(`/api/update/global-tasks/${projectId}`, {
      method: 'PUT',
      body: { description: description || '' },
    })
    notifyProjectParticipants(pool, {
      projectId,
      excludeUserId: userId,
      title: 'Обновлено описание проекта',
      body: (await getProjectMeta(pool, projectId).catch(() => null))?.title || `Проект #${projectId}`,
      type: 'project_description',
    })
    return res.json({ result })
  } catch (error) {
    console.error('[mobile_staff_app][projects][description]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка обновления описания' })
  }
}

const updateGoals = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const projectId = req.params.projectId
    const { goals } = req.body || {}
    await assertAuthor(projectId, userId)
    const cleaned = Array.isArray(goals)
      ? goals.map((g) => String(g || '').trim()).filter(Boolean)
      : []
    const result = await registerFetch(`/api/tasks/${projectId}/update-goals`, {
      method: 'PUT',
      body: { goals: cleaned, userId },
    })
    notifyProjectParticipants(pool, {
      projectId,
      excludeUserId: userId,
      title: 'Обновлены цели проекта',
      body: (await getProjectMeta(pool, projectId).catch(() => null))?.title || `Проект #${projectId}`,
      type: 'project_goals',
    })
    return res.json({ result })
  } catch (error) {
    console.error('[mobile_staff_app][projects][goals]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка обновления целей' })
  }
}

const updateAdditionalInfo = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const projectId = req.params.projectId
    const { additional_info } = req.body || {}
    await assertAuthor(projectId, userId)
    const info =
      additional_info && typeof additional_info === 'object' && !Array.isArray(additional_info)
        ? additional_info
        : {}
    const result = await registerFetch(`/api/tasks/${projectId}/update-additional-info`, {
      method: 'PUT',
      body: { additional_info: info },
    })
    return res.json({ result })
  } catch (error) {
    console.error('[mobile_staff_app][projects][additionalInfo]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка обновления доп. информации' })
  }
}

const addResponsibles = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const projectId = req.params.projectId
    const { responsibles } = req.body || {}
    await assertAuthor(projectId, userId)
    if (!Array.isArray(responsibles) || responsibles.length === 0) {
      return res.status(400).json({ message: 'Укажите участников' })
    }
    const result = await registerFetch(
      `/api/global-tasks/${projectId}/responsibles-new`,
      {
        method: 'POST',
        body: {
          userId,
          responsibles: responsibles.map((r) => ({
            id: Number(r.id),
            role: r.role || 'Участник',
            requires_approval: Boolean(r.requires_approval),
          })),
        },
      }
    )
    // push: register participant_added / responsiblesAdded
    return res.status(201).json(result)
  } catch (error) {
    console.error('[mobile_staff_app][projects][addResponsibles]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка добавления участников' })
  }
}

const removeResponsible = () => async (req, res) => {
  try {
    const userId = req.user.userId
    const projectId = req.params.projectId
    const targetUserId = req.params.userId
    await assertAuthor(projectId, userId)
    const result = await registerFetch(
      `/api/global-tasks/${projectId}/responsibles/${targetUserId}`,
      {
        method: 'DELETE',
        body: { requesterId: userId },
      }
    )
    // push: register participant_removed
    return res.json(result)
  } catch (error) {
    console.error('[mobile_staff_app][projects][removeResponsible]', error)
    return res
      .status(error.status || 500)
      .json({ message: error.message || 'Ошибка удаления участника' })
  }
}

module.exports = {
  listProjects,
  getProject,
  createProject,
  updateStatus,
  setApproval,
  getMessages,
  sendMessage,
  updateMessage,
  deleteMessage,
  addAttachment,
  getHistory,
  getSubtasks,
  updateDescription,
  updateGoals,
  updateAdditionalInfo,
  addResponsibles,
  removeResponsible,
}
