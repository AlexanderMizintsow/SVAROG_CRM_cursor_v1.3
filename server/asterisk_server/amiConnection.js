// Повторный вход в AMI после обрыва.
// Пароль нужен при каждом новом TCP-соединении, не только при первом.

const DEFAULT_RECONNECT = {
  minDelayMs: 5000,
  maxDelayMs: 30000,
  multiplier: 2,
};

const parseAmiBlock = (raw) => {
  const fields = {};
  let count = 0;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const index = line.indexOf(":");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (fields[key] === undefined) fields[key] = value;
    count += 1;
  }
  return count ? fields : null;
};

const createAmiConnection = ({
  host,
  port,
  username,
  secret,
  socketFactory,
  onEvent,
  onStatus,
  silent = false,
  reconnect = DEFAULT_RECONNECT,
}) => {
  let socket = null;
  let buffer = "";
  let reconnectTimer = null;
  let delayMs = reconnect.minDelayMs;
  let stopped = false;
  let tcpOpen = false;
  let loggedIn = false;
  let replacing = false;
  const pending = new Map();

  const rejectCode = (code) => {
    const error = new Error(code);
    error.code = code;
    return error;
  };

  const failPending = (code) => {
    for (const [id, waiter] of pending) {
      pending.delete(id);
      clearTimeout(waiter.timer);
      waiter.reject(rejectCode(code));
    }
  };

  const loginFrame = () =>
    `Action: Login\r\nUsername: ${username}\r\nSecret: ${secret}\r\n\r\n`;

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const report = (name) => {
    if (onStatus) onStatus(name);
  };

  const handleFields = (fields) => {
    if (!fields) return;
    if (fields.ActionID && fields.Response && pending.has(fields.ActionID)) {
      const waiter = pending.get(fields.ActionID);
      pending.delete(fields.ActionID);
      clearTimeout(waiter.timer);
      waiter.resolve(fields);
    }
    if (
      fields.Response === "Success" &&
      /Authentication accepted/i.test(fields.Message || "")
    ) {
      loggedIn = true;
      delayMs = reconnect.minDelayMs;
      if (!silent) console.log("AMI login accepted");
      report("login_accepted");
    } else if (
      fields.Response === "Error" &&
      !fields.Event &&
      (!loggedIn || /auth/i.test(fields.Message || ""))
    ) {
      loggedIn = false;
      if (!silent) console.error("AMI login rejected:", fields.Message || "");
      report("login_rejected");
    }
    if (fields.Event && onEvent) onEvent(fields);
  };

  const consume = (chunk) => {
    buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    if (buffer.length > 2000000) {
      buffer = "";
      console.error("AMI: сброшен слишком большой буфер");
      return;
    }
    let splitAt = buffer.indexOf("\n\n");
    while (splitAt !== -1) {
      const raw = buffer.slice(0, splitAt);
      buffer = buffer.slice(splitAt + 2);
      try {
        handleFields(parseAmiBlock(raw));
      } catch (error) {
        console.error("Ошибка разбора блока AMI:", error.message);
      }
      splitAt = buffer.indexOf("\n\n");
    }
  };

  const schedule = () => {
    if (stopped || reconnectTimer) return;
    if (!silent) {
      console.log(
        `Connection closed. Reconnecting in ${Math.floor(delayMs / 1000)}s...`
      );
    }
    report("reconnect_scheduled");
    const wait = delayMs;
    delayMs = Math.min(delayMs * reconnect.multiplier, reconnect.maxDelayMs);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, wait);
  };

  const bind = (sock) => {
    sock.on("connect", () => {
      tcpOpen = true;
      buffer = "";
      try {
        sock.write(loginFrame());
        if (!silent) console.log("Connected to Asterisk AMI, login sent");
        report("login_sent");
      } catch (error) {
        console.error("Не удалось отправить вход AMI:", error.message);
      }
    });

    sock.on("data", (chunk) => {
      try {
        consume(chunk);
      } catch (error) {
        buffer = "";
        console.error("Ошибка чтения AMI:", error.message);
      }
    });

    sock.on("error", (error) => {
      if (!silent) console.error("Error: " + error.message);
    });

    sock.on("end", () => {
      if (!silent) console.log("Connection ended.");
      report("ended");
    });

    sock.on("close", () => {
      tcpOpen = false;
      loggedIn = false;
      failPending("ami_offline");
      if (replacing || stopped) return;
      schedule();
    });
  };

  const replaceSocket = () => {
    replacing = true;
    const old = socket;
    socket = null;
    tcpOpen = false;
    if (old) {
      old.removeAllListeners();
      try {
        old.destroy();
      } catch (error) {
        console.error("Ошибка закрытия сокета AMI:", error.message);
      }
    }
    replacing = false;
  };

  const connect = () => {
    if (stopped || tcpOpen) return;
    if (!socket) {
      socket = socketFactory();
      bind(socket);
    }
    try {
      socket.connect(port, host);
    } catch (error) {
      console.error("Ошибка запуска подключения к AMI:", error.message);
      replaceSocket();
      try {
        socket = socketFactory();
        bind(socket);
        socket.connect(port, host);
      } catch (retryError) {
        console.error("Повторное подключение AMI не удалось:", retryError.message);
        schedule();
      }
    }
  };

  const sendAction = (frame, actionId, timeoutMs = 4000) =>
    new Promise((resolve, reject) => {
      if (!tcpOpen || !socket || !loggedIn) {
        reject(rejectCode("ami_offline"));
        return;
      }
      if (pending.has(actionId)) {
        reject(rejectCode("ami_busy"));
        return;
      }
      const timer = setTimeout(() => {
        pending.delete(actionId);
        reject(rejectCode("ami_timeout"));
      }, timeoutMs);
      pending.set(actionId, { resolve, reject, timer });
      try {
        socket.write(frame);
      } catch (error) {
        clearTimeout(timer);
        pending.delete(actionId);
        reject(error);
      }
    });

  return {
    start: connect,
    sendAction,
    stop: () => {
      stopped = true;
      clearReconnectTimer();
      failPending("ami_offline");
      replaceSocket();
    },
  };
};

module.exports = {
  createAmiConnection,
  parseAmiBlock,
};
