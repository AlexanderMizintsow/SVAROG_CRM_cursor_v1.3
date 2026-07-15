const REGISTER_URL = (process.env.REGISTER_URL || 'http://127.0.0.1:5000').replace(/\/$/, '')

const registerFetch = async (path, options = {}) => {
  const headers = { ...(options.headers || {}) }
  if (options.body && !headers['Content-Type'] && !(options.body instanceof Buffer)) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${REGISTER_URL}${path}`, {
    ...options,
    headers,
    body:
      options.body && typeof options.body === 'object' && !(options.body instanceof Buffer)
        ? JSON.stringify(options.body)
        : options.body,
  })

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!response.ok) {
    const message =
      (data && (data.error || data.message || data)) || `Register error ${response.status}`
    const err = new Error(typeof message === 'string' ? message : 'Ошибка register API')
    err.status = response.status
    err.data = data
    throw err
  }

  return data
}

module.exports = {
  REGISTER_URL,
  registerFetch,
}
