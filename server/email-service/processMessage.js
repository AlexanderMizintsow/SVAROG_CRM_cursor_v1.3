const { simpleParser } = require('mailparser')
//const _ = require('lodash')

// Функция обработки сообщения: парсинг текста и обработка вложений
async function processMessage(res) {
  const header = _.find(res.parts, { which: 'HEADER' })
  const textPart = _.find(res.parts, { which: 'TEXT' })

  if (
    header &&
    header.body &&
    header.body.subject &&
    header.body.subject.length > 0 &&
    header.body.from &&
    header.body.from.length > 0
  ) {
    const subject = header.body.subject[0]
    const from = header.body.from[0]
    const to = header.body.to ? header.body.to[0] : 'Неизвестный получатель'
    const date = header.body.date ? header.body.date[0] : null
    const messageId = header.body['message-id']
      ? header.body['message-id'][0]
      : null

    let body = 'Текстовое содержимое отсутствует'
    let attachments = []

    if (textPart) {
      if (textPart.body.includes('Content-Transfer-Encoding: base64')) {
        const base64Content = textPart.body
          .split('Content-Transfer-Encoding: base64')[1]
          .trim()
        body = Buffer.from(base64Content, 'base64').toString('utf-8')
      } else {
        const parsed = await simpleParser(textPart.body)
        body = parsed.text || parsed.html || 'Текстовое содержимое отсутствует'
        attachments = parsed.attachments.map((attachment) => {
          return {
            filename: attachment.filename,
            contentType: attachment.contentType,
            content: attachment.content,
          }
        })
      }
    }

    return {
      uid: res.attributes.uid,
      date,
      from,
      to,
      subject,
      messageId,
      body,
      attachments,
      read: res.attributes.flags.includes('\\Seen'),
    }
  } else {
    console.log('Отсутствует заголовок или тема сообщения:', res)
    return null
  }
}

module.exports = { processMessage }
