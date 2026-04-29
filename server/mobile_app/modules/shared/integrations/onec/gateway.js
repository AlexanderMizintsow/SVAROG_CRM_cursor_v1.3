const { executeOneCTransport } = require('./transport')
const { buildOneCMessage } = require('./messageBuilder')
const { commandRegistry } = require('./commandRegistry')

const execute = async (commandName, args = {}) => {
  const command = commandRegistry[commandName]
  if (!command) {
    throw new Error(`unknown oneC command: ${commandName}`)
  }

  const scan = command.buildScan(args)
  const message = buildOneCMessage({
    protocol: command.protocol,
    scan,
    date: args.date || null,
  })

  const raw = await executeOneCTransport({ message })
  const parsed = command.parser(raw)

  return {
    command: commandName,
    scan,
    raw,
    parsed,
  }
}

module.exports = {
  oneCGateway: {
    execute,
  },
}
