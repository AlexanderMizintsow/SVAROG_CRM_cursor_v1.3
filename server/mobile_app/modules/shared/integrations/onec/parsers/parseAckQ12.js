const parseAckQ12 = (raw) => {
  const normalized = String(raw || '').toLowerCase()
  return {
    ok: normalized.includes('q12\x01'),
    raw: String(raw || ''),
  }
}

module.exports = {
  parseAckQ12,
}
