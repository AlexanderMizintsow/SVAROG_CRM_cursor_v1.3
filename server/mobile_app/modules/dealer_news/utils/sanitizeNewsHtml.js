const sanitizeHtml = require('sanitize-html')

const allowedTags = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'a',
  'img',
  'span',
]

const allowedAttributes = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height', 'data-size', 'data-align'],
  span: ['class'],
  '*': ['style'],
}

const allowedStyles = {
  '*': {
    'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
    'font-size': [/^\d+(px|rem|em|%)$/],
    color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\((\s*\d+\s*,){2}\s*\d+\s*\)$/],
  },
}

const sanitizeNewsHtml = (html) =>
  sanitizeHtml(String(html || ''), {
    allowedTags,
    allowedAttributes,
    allowedStyles,
    allowedSchemes: ['http', 'https', 'data'],
    parseStyleAttributes: true,
  })

module.exports = {
  sanitizeNewsHtml,
}
