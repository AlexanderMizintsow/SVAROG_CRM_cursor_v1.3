const buildOneCMessage = ({ protocol = 'Q11', scan, date = null }) => {
  if (!scan) {
    throw new Error('scan is required for oneC message')
  }

  if (!['Q11', 'Q12'].includes(protocol)) {
    throw new Error(`unsupported oneC protocol: ${protocol}`)
  }

  const dateSuffix = date ? `D${date}` : ''
  return `${protocol}\x01EB35000999\x02\t${scan}${dateSuffix}\r`
}

module.exports = {
  buildOneCMessage,
}
