const { parseV6R } = require('./parsers/parseV6R')
const { parseClosedClaims } = require('./parsers/parseClosedClaims')
const { parseAckQ12 } = require('./parsers/parseAckQ12')

const normalizeClaimNumber = (requestNumber) => String(requestNumber || '').replace(/\D/g, '').padStart(9, '0')

const commandRegistry = {
  'complaint.list': {
    protocol: 'Q11',
    buildScan: ({ inn }) => `V6R${inn}`,
    parser: parseV6R,
  },
  'complaint.closed': {
    protocol: 'Q11',
    buildScan: () => 'V6Z',
    parser: parseClosedClaims,
  },
  'complaint.rating': {
    protocol: 'Q12',
    buildScan: ({ requestNumber, rating }) => `V0N${normalizeClaimNumber(requestNumber)}Q${rating}`,
    parser: parseAckQ12,
  },
}

module.exports = {
  commandRegistry,
}
