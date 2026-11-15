// Если таблица accepted_calls содержит null то считать пропущенным звонком.
// Журнал AMI в файлы здесь не пишется.

require("dotenv").config();
const net = require("net");
const { Pool } = require("pg");
const io = require("socket.io-client");
const { createAmiConnection } = require("./amiConnection");
const { createCallTracker } = require("./callCard");
const { ensureCallCardSchema, saveCallCard } = require("./callCardStore");
const { normalizePhone } = require("./phoneNumber");
const { buildOriginate } = require("./originateCall");
const { getCallParty } = require("./callParty");
const { readExtensionStatus } = require("./extensionStatus");

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "Svarog",
  password: process.env.DB_PASSWORD || "postgres",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  connectionTimeoutMillis: 10000,
});

pool.on("error", (error) => {
  console.error("Ошибка соединения с базой звонков:", error.message);
});

const amiHost = process.env.AMI_HOST || "192.168.57.165";
const amiPort = parseInt(process.env.AMI_PORT || "5038", 10);
const amiUser = process.env.AMI_USER || "ats";
const amiPassword = process.env.AMI_PASSWORD || "S2s14q98svf32a";

const crmSocket = io(process.env.CRM_SOCKET_URL || "http://127.0.0.1:5004");

crmSocket.on("connect", () => {
  console.log("Asterisk сервер подключен к CRM серверу");
  crmSocket.emit("register_pbx");
});

const replyOriginate = (requestId, body) => {
  try {
    crmSocket.emit("originate_result", { requestId, ...body });
  } catch (error) {
    console.error("Не удалось ответить CRM по набору:", error.message);
  }
};

crmSocket.on("originate_call", async (payload) => {
  const requestId = payload && payload.requestId;
  try {
    const built = buildOriginate({
      extension: payload && payload.extension,
      stationNumber: payload && payload.stationNumber,
      actionId: `crm-${Date.now()}`,
    });
    const response = await ami.sendAction(built.frame, built.actionId, 4000);
    if (response.Response !== "Success") {
      replyOriginate(requestId, {
        ok: false,
        message: response.Message || "АТС не приняла набор",
      });
      return;
    }
    console.log(
      `Набор отправлен: добавочный ${built.extension}, номер ${built.stationNumber}`
    );
    replyOriginate(requestId, {
      ok: true,
      message: `Сначала зазвонит добавочный ${built.extension}, затем номер ${built.stationNumber}.`,
    });
  } catch (error) {
    console.error("Набор не отправлен:", error.message);
    replyOriginate(requestId, {
      ok: false,
      message:
        error.code === "ami_offline" || error.code === "ami_timeout"
          ? "АТС сейчас недоступна. Набор не отправлен, станция не затронута."
          : "Не удалось отправить набор.",
    });
  }
});

crmSocket.on("disconnect", () => {
  console.log("Asterisk сервер отключен от CRM сервера");
});

crmSocket.on("connect_error", (error) => {
  console.error("Ошибка подключения Asterisk к CRM серверу:", error.message);
});

const isInternalNumber = (phoneNumber) => {
  if (!phoneNumber) return false;
  return String(phoneNumber).length === 3;
};

const queryPhone = async (sql, phoneNumber) => {
  const key = normalizePhone(phoneNumber);
  if (!key) return null;
  try {
    const result = await pool.query(sql, [key]);
    return result.rows[0] || null;
  } catch (error) {
    if (error.code !== "42883") {
      console.error("Ошибка поиска по номеру:", error.message);
      return null;
    }
    return null;
  }
};

const findUserByPhoneNumber = async (phoneNumber) => {
  const found = await queryPhone(
    `SELECT u.id, u.first_name, u.middle_name, u.last_name, up.phone_type
     FROM users u
     JOIN user_phones up ON u.id = up.user_id
     WHERE phone_key(up.phone_number) = $1
     LIMIT 1`,
    phoneNumber
  );
  if (found) return found;
  try {
    const result = await pool.query(
      `SELECT u.id, u.first_name, u.middle_name, u.last_name, up.phone_type
       FROM users u
       JOIN user_phones up ON u.id = up.user_id
       WHERE up.phone_number = $1
       LIMIT 1`,
      [phoneNumber]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error("Ошибка при поиске пользователя по номеру:", error.message);
    return null;
  }
};

const findDealerByPhoneNumber = async (phoneNumber) => {
  const found = await queryPhone(
    `SELECT d.id, d.first_name, d.middle_name, d.last_name, c.name_companies as company_name
     FROM dealers d
     JOIN companies c ON d.company_id = c.id
     WHERE d.id IN (
       SELECT dpn.dealer_id
       FROM dealer_phone_numbers dpn
       WHERE phone_key(dpn.phone_number) = $1
       UNION
       SELECT d2.id
       FROM dealers d2
       JOIN phone_numbers_companies pnc ON pnc.company_id = d2.company_id
       WHERE phone_key(pnc.phone_number) = $1
     )
     ORDER BY d.id
     LIMIT 1`,
    phoneNumber
  );
  if (found) return found;
  try {
    const result = await pool.query(
      `SELECT d.id, d.first_name, d.middle_name, d.last_name, c.name_companies as company_name
       FROM dealers d
       JOIN dealer_phone_numbers dpn ON d.id = dpn.dealer_id
       JOIN companies c ON d.company_id = c.id
       WHERE dpn.phone_number = $1
       LIMIT 1`,
      [phoneNumber]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error("Ошибка при поиске дилера по номеру:", error.message);
    return null;
  }
};

const personName = (row) =>
  `${row.last_name} ${row.first_name} ${row.middle_name || ""}`.trim();

const publishCall = async (callData, type) => {
  try {
    const outgoing = callData.direction === "outgoing";
    const partyPhone = outgoing ? callData.receiverNumber : callData.callerNumber;
    const managerPhone = outgoing
      ? callData.extension || callData.callerNumber
      : callData.receiverNumber;
    if (!partyPhone || isInternalNumber(partyPhone)) return;
    if (!managerPhone) return;

    const manager = await findUserByPhoneNumber(managerPhone);
    if (!manager) {
      console.log(`Менеджер не найден по добавочному ${managerPhone}`);
      return;
    }

    const party = await getCallParty(pool, partyPhone);
    const contact = party.contactName || party.companyName || "Неизвестный";
    const notificationData = {
      type,
      direction: callData.direction || "incoming",
      callId: callData.callId || null,
      receiverUserId: manager.id,
      receiverName: personName(manager),
      callerNumber: partyPhone,
      externalNumber: partyPhone,
      callerName: contact,
      callerType: party.known ? "dealer" : "unknown",
      companyId: party.companyId,
      companyName: party.companyName,
      dealerId: party.dealerId,
      contactName: party.contactName,
      lastComment: party.lastComment,
      lastCommentAt: party.lastCommentAt,
      receiverNumber: managerPhone,
      timestamp: new Date().toISOString(),
      channel: callData.channel,
      uniqueid: callData.uniqueid,
      duration: callData.talkSeconds || 0,
    };

    console.log(`Окно звонка ${type}:`, partyPhone, contact);
    crmSocket.emit(type, notificationData);
  } catch (error) {
    console.error("Ошибка окна звонка:", error.message);
  }
};

const sendIncomingCallNotification = (callData) =>
  publishCall(callData, "incoming_call");

const sendCallStartedNotification = (callData) =>
  publishCall(callData, "call_started");

const sendCallEndedNotification = (callData) =>
  publishCall(callData, "call_ended");

const runtime = new Map();
const saveQueue = new Map();

const remember = (uniqueid) => {
  if (!runtime.has(uniqueid)) {
    runtime.set(uniqueid, {
      notified: false,
      started: false,
      finished: false,
      callId: null,
    });
  }
  return runtime.get(uniqueid);
};

// События одного звонка приходят пачкой. Запись в базу идёт по порядку,
// чтобы черновик в момент ответа не затёр длительность с отбоя.
const enqueue = (uniqueid, job) => {
  const previous = saveQueue.get(uniqueid) || Promise.resolve();
  const next = previous.then(job, job);
  saveQueue.set(uniqueid, next);
  return next;
};

const persist = async (card) => {
  try {
    return await saveCallCard(pool, card);
  } catch (error) {
    console.error("Database error: " + error.message);
    return null;
  }
};

const onProgress = (card) => {
  if (!card || (card.direction !== "incoming" && card.direction !== "outgoing")) {
    return;
  }
  const partyPhone =
    card.direction === "outgoing" ? card.receiverNumber : card.callerNumber;
  if (!partyPhone) return;
  const state = remember(card.uniqueid);
  const shouldNotify = !state.notified && Boolean(card.extension);
  const shouldStart = card.answered && !state.started;
  if (shouldNotify) state.notified = true;
  if (shouldStart) state.started = true;
  if (!shouldNotify && !shouldStart) return;

  return enqueue(card.uniqueid, async () => {
    const forManager = (extra = {}) =>
      card.direction === "outgoing"
        ? { ...card, ...extra }
        : { ...card, ...extra, receiverNumber: card.extension };

    if (shouldNotify) {
      await sendIncomingCallNotification(forManager());
    }

    if (shouldStart) {
      const callId = await persist(card);
      state.callId = callId;
      if (callId) {
        await sendCallStartedNotification(forManager({ callId }));
      }
    }
  });
};

const onDone = (card) => {
  if (!card) return;
  const state = remember(card.uniqueid);
  if (state.finished) return;
  state.finished = true;

  return enqueue(card.uniqueid, async () => {
  const callId = await persist(card);
  state.callId = callId || state.callId;

  console.log("=== CALL SUMMARY ===");
  console.log(`Uniqueid: ${card.uniqueid}`);
  console.log(`Direction: ${card.direction}`);
  console.log(`Channel: ${card.channel}`);
  console.log(`Caller Number: ${card.callerNumber}`);
  console.log(`Receiver Number: ${card.receiverNumber}`);
  console.log(`Extension: ${card.extension}`);
  console.log(`Status: ${card.status}`);
  console.log(`Talk: ${card.talkSeconds}`);
  console.log(`Recording: ${card.recordingPath || ""}`);
  console.log("====================");

  if (callId) {
    try {
      await pool.query(`NOTIFY new_call_channel, '${callId.toString()}'`);
    } catch (error) {
      console.error("Ошибка уведомления о звонке:", error.message);
    }
  }

  if (card.direction === "incoming" || card.direction === "outgoing") {
    await sendCallEndedNotification({
      ...card,
      callId: state.callId,
      receiverNumber: card.direction === "outgoing" ? card.receiverNumber : card.extension,
    });
  }

  runtime.delete(card.uniqueid);
  saveQueue.delete(card.uniqueid);
  });
};

const tracker = createCallTracker({
  onProgress,
  onDone,
});

const ami = createAmiConnection({
  host: amiHost,
  port: amiPort,
  username: amiUser,
  secret: amiPassword,
  socketFactory: () => new net.Socket(),
  onEvent: (fields) => {
    try {
      tracker.feed(fields);
    } catch (error) {
      console.error("Ошибка карточки звонка:", error.message);
    }
    try {
      const line = readExtensionStatus(fields);
      if (line) crmSocket.emit("extension_status", line);
    } catch (error) {
      console.error("Ошибка занятости линии:", error.message);
    }
  },
  onStatus: (name) => {
    if (name !== "login_accepted") return;
    ami
      .sendAction(
        "Action: ExtensionStateList\r\nActionID: crm-ext-state\r\n\r\n",
        "crm-ext-state",
        4000
      )
      .catch((error) => {
        console.error("Список линий не получен:", error.message);
      });
  },
});

const start = async () => {
  try {
    await ensureCallCardSchema(pool);
    console.log("Поля карточки звонка готовы");
  } catch (error) {
    console.error(
      "Не удалось подготовить поля карточки звонка:",
      error.message
    );
  }
  ami.start();
};

start();
