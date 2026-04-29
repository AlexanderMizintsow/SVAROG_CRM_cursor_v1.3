const net = require('net')
const iconv = require('iconv-lite')

const DEFAULT_TIMEOUT_MS = 15000
const DEFAULT_CONNECT_TIMEOUT_MS = 5000

const executeOneCTransport = ({
  message,
  host = process.env.ONEC_HOST || '192.168.57.77',
  port = Number(process.env.ONEC_PORT || 8240),
  encoding = 'windows-1251',
  timeoutMs = DEFAULT_TIMEOUT_MS,
  connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS,
}) =>
  new Promise((resolve, reject) => {
    const client = new net.Socket()
    let responseBuffer = ''
    let settled = false
    let responseTimeout

    const finalize = (handler, payload) => {
      if (settled) return
      settled = true
      client.destroy()
      handler(payload)
    }

    const connectTimeout = setTimeout(() => {
      finalize(reject, new Error(`oneC connect timeout (${connectTimeoutMs}ms)`))
    }, connectTimeoutMs)

    responseTimeout = setTimeout(() => {
      finalize(reject, new Error(`oneC response timeout (${timeoutMs}ms)`))
    }, timeoutMs)

    client.connect(port, host, () => {
      clearTimeout(connectTimeout)
      client.write(iconv.encode(message, encoding))
    })

    client.on('data', (chunk) => {
      responseBuffer += iconv.decode(chunk, encoding)
      // Ответ 1С может приходить без мгновенного закрытия сокета.
      // Если есть маркер q11/q12, считаем ответ завершенным и не ждем close.
      const normalized = responseBuffer.toLowerCase()
      if (normalized.includes('q11\x01') || normalized.includes('q12\x01')) {
        clearTimeout(responseTimeout)
        finalize(resolve, responseBuffer)
      }
    })

    client.on('close', () => {
      clearTimeout(connectTimeout)
      clearTimeout(responseTimeout)
      if (!settled) {
        finalize(resolve, responseBuffer)
      }
    })

    client.on('error', (error) => {
      clearTimeout(connectTimeout)
      clearTimeout(responseTimeout)
      finalize(reject, error)
    })

    client.on('timeout', () => {
      clearTimeout(connectTimeout)
      clearTimeout(responseTimeout)
      finalize(reject, new Error('oneC socket timeout'))
    })
  })

module.exports = {
  executeOneCTransport,
}
