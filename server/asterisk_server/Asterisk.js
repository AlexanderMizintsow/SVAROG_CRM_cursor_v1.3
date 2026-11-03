// Если таблица accepted_calls  содержит null то считать пропущенным звонком

require("dotenv").config();
const net = require("net");
const { Pool } = require("pg");
const path = require("path");
const io = require("socket.io-client");
const amiDiagnostics = require("./amiDiagnostics");

const diag = (name, details) => {
  try {
    amiDiagnostics.trace(name, details || {});
  } catch (error) {
    // Журнал не должен влиять на приём звонков.
  }
};

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "Svarog",
  password: "postgres",
  port: 5432,
});

const amiHost = "192.168.57.165"; // IP-адрес Asterisk сервера
const amiPort = 5038;
const amiUser = "ats";
const amiPassword = "S2s14q98svf32a";

// Создание клиента для подключения к Asterisk AMI
const client = new net.Socket();
let currentCall = {};
const reconnectConfig = {
  minDelayMs: 5000,
  maxDelayMs: 30000,
  multiplier: 2,
};
let reconnectDelayMs = reconnectConfig.minDelayMs;
let reconnectTimer = null;
let isAmiConnected = false;
let lastAmiVerboseLogAt = 0;
const amiVerboseLogCooldownMs = 10000;

const clearReconnectTimer = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

const connectToAmi = () => {
  if (isAmiConnected) {
    return;
  }

  try {
    client.connect(amiPort, amiHost);
  } catch (error) {
    console.error("Ошибка запуска подключения к AMI:", error.message);
  }
};

const scheduleReconnect = () => {
  if (reconnectTimer) {
    return;
  }

  console.log(
    `Connection closed. Reconnecting in ${Math.floor(
      reconnectDelayMs / 1000
    )}s...`
  );
  diag("ami_reconnect_scheduled", { reconnectDelayMs });

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToAmi();
  }, reconnectDelayMs);

  reconnectDelayMs = Math.min(
    reconnectDelayMs * reconnectConfig.multiplier,
    reconnectConfig.maxDelayMs
  );
};

// Подключение к CRM серверу для отправки уведомлений
const crmSocket = io("http://127.0.0.1:5004");

crmSocket.on("connect", () => {
  console.log("Asterisk сервер подключен к CRM серверу");
  diag("crm_socket_connected", {});
});

crmSocket.on("disconnect", (reason) => {
  console.log("Asterisk сервер отключен от CRM сервера");
  diag("crm_socket_disconnected", { reason: reason || "" });
});

crmSocket.on("connect_error", (error) => {
  console.error("Ошибка подключения Asterisk к CRM серверу:", error);
  diag("crm_socket_error", { message: error && error.message });
});

// Определение пути к рабочему столу
const desktopPath = path.join(
  process.env.HOME || process.env.USERPROFILE,
  "Desktop"
);

// Функция для проверки внутренних номеров
const isInternalNumber = (phoneNumber) => {
  if (!phoneNumber) return false;

  // Проверяем, является ли номер трехзначным
  if (phoneNumber.length === 3) {
    return true;
  }

  // Можно добавить другие паттерны внутренних номеров
  // Например, номера начинающиеся с определенных цифр
  // const internalPatterns = [
  //   /^777$/, // Трехзначные номера
  //   /^888$/,
  //   /^999$/,
  //   /^100$/, // Можно добавить другие
  //   /^101$/,
  //   /^102$/,
  // ];

  // return internalPatterns.some((pattern) => pattern.test(phoneNumber));
  return false; // Пока не нужны дополнительные паттерны
};

// Функция для определения пользователя по номеру телефона
const findUserByPhoneNumber = async (phoneNumber) => {
  try {
    const query = `
      SELECT u.id, u.first_name, u.middle_name, u.last_name, up.phone_type
      FROM users u
      JOIN user_phones up ON u.id = up.user_id
      WHERE up.phone_number = $1
    `;
    const result = await pool.query(query, [phoneNumber]);
    const row = result.rows[0] || null;
    diag("lookup_user_phone", {
      phoneNumber,
      found: Boolean(row),
      userId: row ? row.id : null,
      phoneType: row ? row.phone_type : null,
    });
    return row;
  } catch (error) {
    console.error("Ошибка при поиске пользователя по номеру:", error);
    diag("lookup_user_phone_error", {
      phoneNumber,
      message: error.message,
    });
    return null;
  }
};

// Функция для определения дилера по номеру телефона
const findDealerByPhoneNumber = async (phoneNumber) => {
  try {
    const query = `
      SELECT d.id, d.first_name, d.middle_name, d.last_name, c.name_companies as company_name
      FROM dealers d
      JOIN dealer_phone_numbers dpn ON d.id = dpn.dealer_id
      JOIN companies c ON d.company_id = c.id
      WHERE dpn.phone_number = $1
    `;
    const result = await pool.query(query, [phoneNumber]);
    const row = result.rows[0] || null;
    diag("lookup_dealer_phone", {
      phoneNumber,
      found: Boolean(row),
      dealerId: row ? row.id : null,
      companyName: row ? row.company_name : null,
    });
    return row;
  } catch (error) {
    console.error("Ошибка при поиске дилера по номеру:", error);
    diag("lookup_dealer_phone_error", {
      phoneNumber,
      message: error.message,
    });
    return null;
  }
};

// Функция для отправки уведомления о входящем звонке
const sendIncomingCallNotification = async (callData) => {
  try {
    console.log(
      `Попытка отправки уведомления: звонящий=${callData.callerNumber}, получатель=${callData.receiverNumber}`
    );

    // Проверяем, не является ли звонящий внутренним номером
    if (isInternalNumber(callData.callerNumber)) {
      console.log(`Пропускаем внутренний номер: ${callData.callerNumber}`);
      diag("notify_skipped_internal", {
        stage: "incoming",
        callerNumber: callData.callerNumber,
        receiverNumber: callData.receiverNumber,
        channel: callData.channel,
      });
      return;
    }

    // Определяем получателя звонка по номеру, на который звонят
    const receiverUser = await findUserByPhoneNumber(callData.receiverNumber);

    if (receiverUser) {
      console.log(
        `Найден получатель: ${receiverUser.first_name} ${receiverUser.last_name} (ID: ${receiverUser.id})`
      );

      // Определяем звонящего
      const callerUser = await findUserByPhoneNumber(callData.callerNumber);
      const callerDealer = await findDealerByPhoneNumber(callData.callerNumber);

      let callerName = "Неизвестный";
      let callerType = "unknown";

      if (callerUser) {
        callerName = `${callerUser.last_name} ${callerUser.first_name} ${
          callerUser.middle_name || ""
        }`.trim();
        callerType = "user";
        console.log(`Звонящий - пользователь: ${callerName}`);
      } else if (callerDealer) {
        callerName = `${callerDealer.last_name} ${callerDealer.first_name} ${
          callerDealer.middle_name || ""
        }`.trim();
        callerType = "dealer";
        console.log(`Звонящий - дилер: ${callerName}`);
      } else {
        console.log(
          `Звонящий не найден в базе данных: ${callData.callerNumber}`
        );
      }

      const notificationData = {
        type: "incoming_call",
        receiverUserId: receiverUser.id,
        receiverName: `${receiverUser.last_name} ${receiverUser.first_name} ${
          receiverUser.middle_name || ""
        }`.trim(),
        callerNumber: callData.callerNumber,
        callerName: callerName,
        callerType: callerType,
        receiverNumber: callData.receiverNumber,
        timestamp: new Date().toISOString(),
        channel: callData.channel,
      };

      // Отправляем уведомление через WebSocket
      console.log("Отправляем уведомление в CRM сервер:", notificationData);
      crmSocket.emit("incoming_call", notificationData);
      diag("notify_incoming", notificationData);
      console.log(
        `Отправлено уведомление о входящем звонке для пользователя ${receiverUser.id}`
      );
    } else {
      console.log(
        `Получатель не найден в базе данных: ${callData.receiverNumber}`
      );
      diag("notify_incoming_receiver_unknown", {
        callerNumber: callData.callerNumber,
        receiverNumber: callData.receiverNumber,
        channel: callData.channel,
      });
    }
  } catch (error) {
    console.error("Ошибка при отправке уведомления о входящем звонке:", error);
  }
};

// Функция для отправки уведомления о начале разговора
const sendCallStartedNotification = async (callData) => {
  try {
    console.log("Попытка отправки уведомления о начале разговора:", callData);

    // Проверяем, не является ли звонящий внутренним номером
    if (isInternalNumber(callData.callerNumber)) {
      console.log(`Пропускаем внутренний номер: ${callData.callerNumber}`);
      diag("notify_skipped_internal", {
        stage: "started",
        callerNumber: callData.callerNumber,
        receiverNumber: callData.receiverNumber,
        channel: callData.channel,
      });
      return;
    }

    const receiverUser = await findUserByPhoneNumber(callData.receiverNumber);

    if (receiverUser) {
      // Определяем звонящего
      const callerUser = await findUserByPhoneNumber(callData.callerNumber);
      const callerDealer = await findDealerByPhoneNumber(callData.callerNumber);

      let callerName = "Неизвестный";
      let callerType = "unknown";

      if (callerUser) {
        callerName = `${callerUser.last_name} ${callerUser.first_name} ${
          callerUser.middle_name || ""
        }`.trim();
        callerType = "user";
        console.log(`Звонящий - пользователь: ${callerName}`);
      } else if (callerDealer) {
        callerName = `${callerDealer.last_name} ${callerDealer.first_name} ${
          callerDealer.middle_name || ""
        }`.trim();
        callerType = "dealer";
        console.log(`Звонящий - дилер: ${callerName}`);
      } else {
        console.log(
          `Звонящий не найден в базе данных: ${callData.callerNumber}`
        );
      }

      const notificationData = {
        type: "call_started",
        callId: callData.callId, // Добавляем ID звонка
        receiverUserId: receiverUser.id,
        receiverName: `${receiverUser.last_name} ${receiverUser.first_name} ${
          receiverUser.middle_name || ""
        }`.trim(),
        callerNumber: callData.callerNumber,
        callerName: callerName,
        callerType: callerType,
        receiverNumber: callData.receiverNumber,
        timestamp: new Date().toISOString(),
        channel: callData.channel,
      };

      console.log(
        "Отправляем уведомление о начале разговора в CRM сервер:",
        notificationData
      );
      crmSocket.emit("call_started", notificationData);
      diag("notify_started", notificationData);
      console.log(
        `Отправлено уведомление о начале разговора для пользователя ${receiverUser.id}`
      );
    } else {
      console.log(
        `Получатель не найден для уведомления о начале разговора: ${callData.receiverNumber}`
      );
      diag("notify_started_receiver_unknown", {
        callerNumber: callData.callerNumber,
        receiverNumber: callData.receiverNumber,
        channel: callData.channel,
        callId: callData.callId || null,
      });
    }
  } catch (error) {
    console.error("Ошибка при отправке уведомления о начале разговора:", error);
  }
};

// Функция для отправки уведомления о завершении звонка
const sendCallEndedNotification = async (callData, callId) => {
  console.log("=== sendCallEndedNotification вызвана ===");
  console.log("callData:", callData);
  console.log("callId:", callId);

  try {
    // Проверяем, не является ли звонящий внутренним номером
    if (isInternalNumber(callData.callerNumber)) {
      console.log(`Пропускаем внутренний номер: ${callData.callerNumber}`);
      diag("notify_skipped_internal", {
        stage: "ended",
        callerNumber: callData.callerNumber,
        receiverNumber: callData.receiverNumber,
        channel: callData.channel,
        callId,
      });
      return;
    }

    const receiverUser = await findUserByPhoneNumber(callData.receiverNumber);

    if (receiverUser) {
      // Определяем звонящего
      const callerUser = await findUserByPhoneNumber(callData.callerNumber);
      const callerDealer = await findDealerByPhoneNumber(callData.callerNumber);

      let callerName = "Неизвестный";
      let callerType = "unknown";

      if (callerUser) {
        callerName = `${callerUser.last_name} ${callerUser.first_name} ${
          callerUser.middle_name || ""
        }`.trim();
        callerType = "user";
        console.log(`Звонящий - пользователь: ${callerName}`);
      } else if (callerDealer) {
        callerName = `${callerDealer.last_name} ${callerDealer.first_name} ${
          callerDealer.middle_name || ""
        }`.trim();
        callerType = "dealer";
        console.log(`Звонящий - дилер: ${callerName}`);
      } else {
        console.log(
          `Звонящий не найден в базе данных: ${callData.callerNumber}`
        );
      }

      const notificationData = {
        type: "call_ended",
        callId: callId, // Добавляем ID звонка
        receiverUserId: receiverUser.id,
        receiverName: `${receiverUser.last_name} ${receiverUser.first_name} ${
          receiverUser.middle_name || ""
        }`.trim(),
        callerNumber: callData.callerNumber,
        callerName: callerName,
        callerType: callerType,
        receiverNumber: callData.receiverNumber,
        timestamp: new Date().toISOString(),
        channel: callData.channel,
        duration: callData.duration || 0,
      };

      console.log("Отправляем уведомление call_ended:", notificationData);
      crmSocket.emit("call_ended", notificationData);
      diag("notify_ended", notificationData);
      console.log(
        `Отправлено уведомление о завершении звонка для пользователя ${receiverUser.id}`
      );
    } else {
      diag("notify_ended_receiver_unknown", {
        callerNumber: callData.callerNumber,
        receiverNumber: callData.receiverNumber,
        channel: callData.channel,
        callId,
        duration: callData.duration || 0,
      });
    }
  } catch (error) {
    console.error(
      "Ошибка при отправке уведомления о завершении звонка:",
      error
    );
  }
};

const loginToAmi = () => {
  isAmiConnected = true;
  reconnectDelayMs = reconnectConfig.minDelayMs;
  clearReconnectTimer();
  console.log("Connected to Asterisk AMI");
  diag("ami_tcp_connected", { host: amiHost, port: amiPort, user: amiUser });
  client.write(
    `Action: Login\r\nUsername: ${amiUser}\r\nSecret: ${amiPassword}\r\n\r\n`
  );
  const controlProbe = amiDiagnostics.controlProbePacket();
  if (controlProbe) {
    client.write(controlProbe);
  }
};

client.on("connect", loginToAmi);
client.connect(amiPort, amiHost);

client.on("data", async (data) => {
  amiDiagnostics.ingestChunk(data);
  const response = data.toString().split("\r\n");

  // Логируем AMI-события ограниченно, чтобы не засорять консоль.
  const now = Date.now();
  const shouldPrintVerboseAmiLog =
    now - lastAmiVerboseLogAt >= amiVerboseLogCooldownMs;

  if (shouldPrintVerboseAmiLog) {
    lastAmiVerboseLogAt = now;
    console.log("=== AMI EVENT ===");
    response.forEach((line) => {
      if (line.trim()) {
        console.log(`AMI: ${line}`);
      }
    });
    console.log("=================");
  }

  for (const line of response) {
    if (line.includes("Authentication accepted")) {
      console.log("AMI: вход выполнен");
      diag("ami_login_ok", {});
    } else if (line.includes("Authentication failed")) {
      console.error("AMI: вход отклонён");
      diag("ami_login_failed", {});
    }

    if (line.startsWith("Event: Newchannel")) {
      // Начало нового звонка - очищаем предыдущие данные только если это новый канал
      const newChannel = line.split(": ")[1];
      if (!currentCall.channel || currentCall.channel !== newChannel) {
        currentCall = {
          channel: newChannel,
          startTime: new Date(),
          callerNumber: null,
          receiverNumber: null,
          callProcessed: false, // Флаг для отслеживания обработки звонка
          answered: false, // Флаг для отслеживания принятия звонка
          notificationSent: false, // Флаг для предотвращения дублирования уведомлений
        };
        console.log(`New call detected on channel: ${currentCall.channel}`);
        diag("parser_newchannel", { channel: currentCall.channel });
      } else {
        console.log(`Ignoring duplicate Newchannel event for: ${newChannel}`);
        diag("parser_newchannel_duplicate", {
          channel: newChannel,
          keptChannel: currentCall.channel,
        });
      }
    } else if (line.startsWith("CallerIDNum:") && !currentCall.callerNumber) {
      // Caller ID номера - сохраняем только первое значение
      currentCall.callerNumber = line.split(": ")[1];
      console.log(`Caller ID Number: ${currentCall.callerNumber}`);
      diag("parser_caller", {
        channel: currentCall.channel,
        callerNumber: currentCall.callerNumber,
        raw: line,
      });

      // Отправляем уведомление о входящем звонке, если уже есть номер получателя
      if (currentCall.receiverNumber && !currentCall.notificationSent) {
        await sendIncomingCallNotification(currentCall);
        currentCall.notificationSent = true;
      }
    } else if (line.startsWith("CallerIDNum:") && currentCall.callerNumber) {
      // Игнорируем повторные CallerIDNum
      console.log(`Ignoring duplicate CallerIDNum: ${line.split(": ")[1]}`);
      diag("parser_caller_duplicate", {
        channel: currentCall.channel,
        kept: currentCall.callerNumber,
        ignored: line.split(": ")[1],
      });
    } else if (line.startsWith("Exten:") && !currentCall.receiverNumber) {
      // Номер, на который звонят - сохраняем только первое значение
      currentCall.receiverNumber = line.split(": ")[1];
      console.log(`Receiver Number: ${currentCall.receiverNumber}`);
      diag("parser_receiver", {
        channel: currentCall.channel,
        receiverNumber: currentCall.receiverNumber,
        raw: line,
      });

      // Отправляем уведомление о входящем звонке сразу при получении номера получателя
      if (
        currentCall.callerNumber &&
        currentCall.receiverNumber &&
        !currentCall.notificationSent
      ) {
        await sendIncomingCallNotification(currentCall);
        currentCall.notificationSent = true;
      }
    } else if (line.startsWith("Exten:") && currentCall.receiverNumber) {
      // Игнорируем повторные Exten
      console.log(`Ignoring duplicate Exten: ${line.split(": ")[1]}`);
      diag("parser_receiver_duplicate", {
        channel: currentCall.channel,
        kept: currentCall.receiverNumber,
        ignored: line.split(": ")[1],
      });
    } else if (line.startsWith("Event: Dial")) {
      // Событие Dial для получения номера получателя
      // Извлекаем номер из строки Dial
      const dialMatch = line.match(/Exten: (\d+)/);
      if (dialMatch && !currentCall.receiverNumber) {
        currentCall.receiverNumber = dialMatch[1];
        console.log(
          `Receiver Number from Dial event: ${currentCall.receiverNumber}`
        );
        diag("parser_receiver_from_dial", {
          channel: currentCall.channel,
          receiverNumber: currentCall.receiverNumber,
          raw: line,
        });

        // Отправляем уведомление о входящем звонке только здесь
        if (!currentCall.notificationSent) {
          await sendIncomingCallNotification(currentCall);
          currentCall.notificationSent = true;
        }
      }
    } else if (line.startsWith("Event: Answer")) {
      // Звонок принят - начало разговора
      // Проверяем, не был ли звонок уже завершен
      if (currentCall.callProcessed) {
        console.log(
          `Ignoring Answer event for already processed call on channel: ${currentCall.channel}`
        );
        continue;
      }

      currentCall.answered = true;
      console.log(`Call answered on channel: ${currentCall.channel}`);
      diag("parser_answered", {
        via: "answer",
        channel: currentCall.channel,
        callerNumber: currentCall.callerNumber,
        receiverNumber: currentCall.receiverNumber,
        callId: currentCall.callId || null,
      });

      // Создаем запись в базе данных при начале звонка
      if (
        currentCall.callerNumber &&
        currentCall.receiverNumber &&
        !currentCall.callId
      ) {
        try {
          const result = await pool.query(
            "INSERT INTO calls (caller_number, receiver_number, accepted_at, status) VALUES ($1, $2, $3, $4) RETURNING id",
            [
              currentCall.callerNumber,
              currentCall.receiverNumber,
              new Date().toISOString(),
              "accepted",
            ]
          );
          currentCall.callId = result.rows[0].id;
          console.log(`Call record created with ID: ${currentCall.callId}`);
          diag("db_call_inserted", {
            via: "answer",
            callId: currentCall.callId,
            status: "accepted",
            callerNumber: currentCall.callerNumber,
            receiverNumber: currentCall.receiverNumber,
            channel: currentCall.channel,
          });
        } catch (err) {
          console.error(
            "Database error when creating call record: " + err.message
          );
          diag("db_call_error", { via: "answer", message: err.message });
        }
      }

      await sendCallStartedNotification(currentCall);
    } else if (line.startsWith("DialStatus: ANSWER")) {
      // Альтернативное событие принятия звонка
      // Проверяем, не был ли звонок уже завершен
      if (currentCall.callProcessed) {
        console.log(
          `Ignoring DialStatus: ANSWER for already processed call on channel: ${currentCall.channel}`
        );
        continue;
      }

      currentCall.answered = true;
      console.log(
        `Call answered (DialStatus) on channel: ${currentCall.channel}`
      );
      diag("parser_answered", {
        via: "dialstatus",
        channel: currentCall.channel,
        callerNumber: currentCall.callerNumber,
        receiverNumber: currentCall.receiverNumber,
        callId: currentCall.callId || null,
      });

      // Создаем запись в базе данных при начале звонка
      if (
        currentCall.callerNumber &&
        currentCall.receiverNumber &&
        !currentCall.callId
      ) {
        try {
          const result = await pool.query(
            "INSERT INTO calls (caller_number, receiver_number, accepted_at, status) VALUES ($1, $2, $3, $4) RETURNING id",
            [
              currentCall.callerNumber,
              currentCall.receiverNumber,
              new Date().toISOString(),
              "accepted",
            ]
          );
          currentCall.callId = result.rows[0].id;
          console.log(`Call record created with ID: ${currentCall.callId}`);
          diag("db_call_inserted", {
            via: "dialstatus",
            callId: currentCall.callId,
            status: "accepted",
            callerNumber: currentCall.callerNumber,
            receiverNumber: currentCall.receiverNumber,
            channel: currentCall.channel,
          });
        } catch (err) {
          console.error(
            "Database error when creating call record: " + err.message
          );
          diag("db_call_error", { via: "dialstatus", message: err.message });
        }
      }

      await sendCallStartedNotification(currentCall);
    } else if (line.startsWith("Event: Bridge")) {
      // Событие соединения каналов - звонок принят
      // Проверяем, не был ли звонок уже завершен
      if (currentCall.callProcessed) {
        console.log(
          `Ignoring Bridge event for already processed call on channel: ${currentCall.channel}`
        );
        continue;
      }

      currentCall.answered = true;
      console.log(
        `Call bridged (connected) on channel: ${currentCall.channel}`
      );
      diag("parser_answered", {
        via: "bridge",
        channel: currentCall.channel,
        callerNumber: currentCall.callerNumber,
        receiverNumber: currentCall.receiverNumber,
        callId: currentCall.callId || null,
      });

      // Создаем запись в базе данных при начале звонка
      if (
        currentCall.callerNumber &&
        currentCall.receiverNumber &&
        !currentCall.callId
      ) {
        try {
          const result = await pool.query(
            "INSERT INTO calls (caller_number, receiver_number, accepted_at, status) VALUES ($1, $2, $3, $4) RETURNING id",
            [
              currentCall.callerNumber,
              currentCall.receiverNumber,
              new Date().toISOString(),
              "accepted",
            ]
          );
          currentCall.callId = result.rows[0].id;
          console.log(`Call record created with ID: ${currentCall.callId}`);
          diag("db_call_inserted", {
            via: "bridge",
            callId: currentCall.callId,
            status: "accepted",
            callerNumber: currentCall.callerNumber,
            receiverNumber: currentCall.receiverNumber,
            channel: currentCall.channel,
          });
        } catch (err) {
          console.error(
            "Database error when creating call record: " + err.message
          );
          diag("db_call_error", { via: "bridge", message: err.message });
        }
      }

      await sendCallStartedNotification(currentCall);
    } else if (line.startsWith("Event: Unlink")) {
      // Событие разъединения каналов - может указывать на соединение
      if (
        !currentCall.answered &&
        currentCall.callerNumber &&
        currentCall.receiverNumber
      ) {
        currentCall.answered = true;
        console.log(
          `Call unlinked (connected) on channel: ${currentCall.channel}`
        );
        diag("parser_answered", {
          via: "unlink",
          channel: currentCall.channel,
          callerNumber: currentCall.callerNumber,
          receiverNumber: currentCall.receiverNumber,
          callId: currentCall.callId || null,
        });

        // Создаем запись в базе данных при начале звонка
        if (!currentCall.callId) {
          try {
            const result = await pool.query(
              "INSERT INTO calls (caller_number, receiver_number, accepted_at, status) VALUES ($1, $2, $3, $4) RETURNING id",
              [
                currentCall.callerNumber,
                currentCall.receiverNumber,
                new Date().toISOString(),
                "accepted",
              ]
            );
            currentCall.callId = result.rows[0].id;
            console.log(`Call record created with ID: ${currentCall.callId}`);
            diag("db_call_inserted", {
              via: "unlink",
              callId: currentCall.callId,
              status: "accepted",
              callerNumber: currentCall.callerNumber,
              receiverNumber: currentCall.receiverNumber,
              channel: currentCall.channel,
            });
          } catch (err) {
            console.error(
              "Database error when creating call record: " + err.message
            );
            diag("db_call_error", { via: "unlink", message: err.message });
          }
        }

        await sendCallStartedNotification(currentCall);
      }
    } else if (line.startsWith("Event: Hangup")) {
      // Конец звонка - обрабатываем только один раз
      if (currentCall.callProcessed) {
        console.log(
          `Call already processed for channel: ${currentCall.channel}`
        );
        continue;
      }

      currentCall.callProcessed = true;
      currentCall.timestamp = new Date().toISOString();
      currentCall.duration = currentCall.startTime
        ? Math.floor((new Date() - currentCall.startTime) / 1000)
        : 0;

      // Определяем статус звонка
      // По умолчанию считаем звонок пропущенным, если не было события Answer
      const status = currentCall.answered ? "accepted" : "missed";

      // Дополнительная проверка и логирование
      console.log(`=== CALL SUMMARY ===`);
      console.log(`Channel: ${currentCall.channel}`);
      console.log(`Caller Number: ${currentCall.callerNumber}`);
      console.log(`Receiver Number: ${currentCall.receiverNumber}`);
      console.log(`Status: ${status}`);
      console.log(`Duration: ${currentCall.duration}s`);
      console.log(`====================`);
      diag("parser_hangup", {
        channel: currentCall.channel,
        callerNumber: currentCall.callerNumber || null,
        receiverNumber: currentCall.receiverNumber || null,
        status,
        duration: currentCall.duration,
        answered: Boolean(currentCall.answered),
        callId: currentCall.callId || null,
        notificationSent: Boolean(currentCall.notificationSent),
        startTime: currentCall.startTime
          ? new Date(currentCall.startTime).toISOString()
          : null,
      });

      try {
        // Проверяем, что номера не undefined
        if (!currentCall.callerNumber) {
          console.error("Error: Caller number is undefined.");
          diag("db_call_skipped", {
            reason: "caller_undefined",
            channel: currentCall.channel,
            receiverNumber: currentCall.receiverNumber || null,
            status,
          });
          return; // Пропускаем запись в базу данных, если данные неполные
        }

        let callId = currentCall.callId;

        if (callId) {
          // Обновляем существующую запись
          await pool.query("UPDATE calls SET status = $1 WHERE id = $2", [
            status,
            callId,
          ]);
          console.log(`Call record updated with ID: ${callId}`);
          diag("db_call_updated", {
            callId,
            status,
            callerNumber: currentCall.callerNumber,
            receiverNumber: currentCall.receiverNumber,
            duration: currentCall.duration,
            channel: currentCall.channel,
          });
        } else {
          // Создаем новую запись, если ID не был создан ранее
          const result = await pool.query(
            "INSERT INTO calls (caller_number, receiver_number, accepted_at, status) VALUES ($1, $2, $3, $4) RETURNING id",
            [
              currentCall.callerNumber,
              currentCall.receiverNumber,
              currentCall.timestamp,
              status,
            ]
          );
          callId = result.rows[0].id;
          console.log(`Call record created with ID: ${callId}`);
          diag("db_call_inserted", {
            via: "hangup",
            callId,
            status,
            callerNumber: currentCall.callerNumber,
            receiverNumber: currentCall.receiverNumber,
            duration: currentCall.duration,
            channel: currentCall.channel,
          });
        }

        // Отправляем уведомление о новом звонке
        await pool.query(`NOTIFY new_call_channel, '${callId.toString()}'`);

        // Отправляем уведомление о завершении звонка с ID
        console.log("Отправляем уведомление о завершении звонка с ID:", callId);
        await sendCallEndedNotification(currentCall, callId);
        console.log("Уведомление о завершении звонка отправлено");

        // Вывод информации о звонке
        console.log(
          `Call logged: Caller Number: ${currentCall.callerNumber}, Receiver Number: ${currentCall.receiverNumber}, Status: ${status}`
        );
        console.log("Call recording saved in database.");
      } catch (err) {
        console.error("Database error: " + err.message);
        diag("db_call_error", {
          via: "hangup",
          message: err.message,
          channel: currentCall.channel,
          callerNumber: currentCall.callerNumber || null,
          receiverNumber: currentCall.receiverNumber || null,
        });
      } finally {
        // Очищаем текущие данные о звонке только после полной обработки
        setTimeout(() => {
          currentCall = {};
          console.log("CurrentCall cleared after processing");
        }, 1000); // Задержка 1 секунда для обработки всех событий
      }
    }
  }
});

client.on("error", (err) => {
  console.error("Error: " + err.message);
  diag("ami_tcp_error", { message: err.message });
});

client.on("end", () => {
  isAmiConnected = false;
  console.log("Connection ended.");
  try {
    amiDiagnostics.flushPartial("connection_end");
  } catch (error) {
    // Неполный хвост журнала не должен ронять приём звонков.
  }
  diag("ami_tcp_end", {});
});

client.on("close", () => {
  isAmiConnected = false;
  diag("ami_tcp_closed", { reconnectDelayMs });
  scheduleReconnect();
});
