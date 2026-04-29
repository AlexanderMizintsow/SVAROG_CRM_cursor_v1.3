const { complaintsService } = require('../services/complaintsService')
const {
  validateDraftNodePayload,
  validateDraftStartPayload,
  validateRatingPayload,
} = require('../validators/complaintValidators')

const toError = (res, error) => {
  const rawMessage = String(error?.message || 'Unexpected server error')
  let message = rawMessage
  let status = /required|allowed|not found|missing/i.test(rawMessage) ? 400 : 500

  if (/onec response timeout|onec connect timeout|onec socket timeout/i.test(rawMessage)) {
    status = 503
    message = 'Сервис 1С временно недоступен. Попробуйте обновить список позже.'
  } else if (/ECONNREFUSED|EHOSTUNREACH|ETIMEDOUT/i.test(rawMessage)) {
    status = 503
    message = 'Нет соединения с сервером 1С. Повторите попытку позже.'
  }

  return res.status(status).json({ message })
}

const startDraft = (pool) => async (req, res) => {
  try {
    const payload = {
      orderNo: req.body.orderNo,
      year: String(req.body.year || ''),
    }
    validateDraftStartPayload(payload)
    const draft = await complaintsService.createDraft(pool, {
      companyId: req.user.companyId,
      orderNo: payload.orderNo,
      year: payload.year,
    })
    return res.status(201).json({ draft })
  } catch (error) {
    return toError(res, error)
  }
}

const getOrderItems = (pool) => async (req, res) => {
  try {
    const orderNo = String(req.query.orderNo || '').trim()
    const year = String(req.query.year || '').trim()
    validateDraftStartPayload({ orderNo, year })
    const items = await complaintsService.fetchOrderItems(pool, {
      companyId: req.user.companyId,
      orderNo,
      year,
    })
    return res.status(200).json({ items })
  } catch (error) {
    return toError(res, error)
  }
}

const addDraftNode = (pool) => async (req, res) => {
  try {
    const payload = {
      item: String(req.body.item || '').trim(),
      part: String(req.body.part || '').trim(),
      reason: String(req.body.reason || '').trim(),
    }
    validateDraftNodePayload(payload)
    const draft = await complaintsService.addDraftNode(pool, {
      companyId: req.user.companyId,
      draftId: Number(req.params.id),
      ...payload,
    })
    return res.status(200).json({ draft })
  } catch (error) {
    return toError(res, error)
  }
}

const uploadDraftAttachment = (pool) => async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'file is required' })
    }
    const attachment = await complaintsService.addDraftAttachment(pool, {
      companyId: req.user.companyId,
      draftId: Number(req.params.id),
      file: req.file,
      caption: String(req.body.caption || '').trim(),
      kind: req.file.mimetype?.startsWith('image/') ? 'photo' : 'document',
    })
    return res.status(201).json({ attachment })
  } catch (error) {
    return toError(res, error)
  }
}

const submitDraft = (pool) => async (req, res) => {
  try {
    const notes = Array.isArray(req.body.notes) ? req.body.notes.map((item) => String(item || '').trim()).filter(Boolean) : []
    const result = await complaintsService.submitDraft(pool, {
      companyId: req.user.companyId,
      draftId: Number(req.params.id),
      notes,
    })
    return res.status(200).json(result)
  } catch (error) {
    return toError(res, error)
  }
}

const createQuickComplaint = (pool) => async (req, res) => {
  try {
    const note = String(req.body.note || '').trim()
    let captions = []
    if (req.body.captionsJson) {
      try {
        const parsed = JSON.parse(String(req.body.captionsJson))
        if (Array.isArray(parsed)) {
          captions = parsed.map((value) => String(value || ''))
        }
      } catch (error) {}
    }
    if (!note && (!req.files || !req.files.length)) {
      return res.status(400).json({ message: 'note or attachment is required' })
    }
    const result = await complaintsService.createQuickComplaint(pool, {
      companyId: req.user.companyId,
      note,
      files: req.files || [],
      captions,
    })
    return res.status(201).json(result)
  } catch (error) {
    return toError(res, error)
  }
}

const getList = (pool) => async (req, res) => {
  try {
    const tickets = await complaintsService.getComplaintList(pool, {
      companyId: req.user.companyId,
    })
    return res.status(200).json({ tickets })
  } catch (error) {
    return toError(res, error)
  }
}

const getTicketDetails = (pool) => async (req, res) => {
  try {
    const ticket = await complaintsService.getComplaintDetails(pool, {
      companyId: req.user.companyId,
      requestNumber: String(req.params.requestNumber || '').trim(),
    })
    if (!ticket) {
      return res.status(404).json({ message: 'ticket not found' })
    }
    return res.status(200).json({ ticket })
  } catch (error) {
    return toError(res, error)
  }
}

const getPendingRatings = (pool) => async (req, res) => {
  try {
    const items = await complaintsService.getPendingRatings(pool, {
      companyId: req.user.companyId,
    })
    return res.status(200).json({ items })
  } catch (error) {
    return toError(res, error)
  }
}

const saveRating = (pool) => async (req, res) => {
  try {
    const rating = Number(req.body.rating)
    validateRatingPayload({ rating })
    const row = await complaintsService.saveRating(pool, {
      companyId: req.user.companyId,
      requestNumber: String(req.params.requestNumber || '').trim(),
      rating,
      comment: String(req.body.comment || '').trim(),
    })
    return res.status(200).json({ rating: row })
  } catch (error) {
    return toError(res, error)
  }
}

const saveRatingComment = (pool) => async (req, res) => {
  try {
    const row = await complaintsService.saveRatingComment(pool, {
      companyId: req.user.companyId,
      requestNumber: String(req.params.requestNumber || '').trim(),
      comment: String(req.body.comment || '').trim(),
    })
    return res.status(200).json({ rating: row })
  } catch (error) {
    return toError(res, error)
  }
}

const getDraft = (pool) => async (req, res) => {
  try {
    const draft = await complaintsService.getDraftById(pool, {
      companyId: req.user.companyId,
      draftId: Number(req.params.id),
    })
    if (!draft) return res.status(404).json({ message: 'draft not found' })
    return res.status(200).json({ draft })
  } catch (error) {
    return toError(res, error)
  }
}

module.exports = {
  startDraft,
  getOrderItems,
  addDraftNode,
  uploadDraftAttachment,
  submitDraft,
  createQuickComplaint,
  getList,
  getPendingRatings,
  getTicketDetails,
  saveRating,
  saveRatingComment,
  getDraft,
}
