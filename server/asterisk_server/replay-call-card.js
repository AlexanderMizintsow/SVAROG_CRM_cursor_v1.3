// Короткий прогон карточки звонка без АТС и без файлового журнала.
// События собраны по образцу дня 2026-11-03.
//
//   node replay-call-card.js
// Пишет четыре звонка в базу, если она доступна, и проверяет повторный вход AMI.

const { EventEmitter } = require("events");
const { Pool } = require("pg");
const { createCallTracker } = require("./callCard");
const { createAmiConnection } = require("./amiConnection");
const { ensureCallCardSchema, saveCallCard } = require("./callCardStore");

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class FakeSocket extends EventEmitter {
  constructor() {
    super();
    this.writes = [];
  }

  connect() {
    this.emit("connect");
  }

  write(data) {
    this.writes.push(String(data));
  }

  destroy() {}
}

const checkLoginOnReconnect = async () => {
  const sockets = [];
  const marks = [];
  const connection = createAmiConnection({
    host: "127.0.0.1",
    port: 1,
    username: "ats",
    secret: "secret",
    reconnect: { minDelayMs: 30, maxDelayMs: 30, multiplier: 1 },
    socketFactory() {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    onEvent() {},
    silent: true,
    onStatus(name) {
      marks.push(name);
    },
  });

  connection.start();
  sockets[0].emit("end");
  sockets[0].emit("close");
  await pause(80);
  connection.stop();

  const loginWrites = sockets[0].writes.filter((item) =>
    item.startsWith("Action: Login\r\n")
  );
  if (loginWrites.length < 2) {
    throw new Error(
      `После обрыва пароль ушёл ${loginWrites.length} раз, нужно минимум 2`
    );
  }
  if (!marks.includes("login_sent") || marks.filter((item) => item === "login_sent").length < 2) {
    throw new Error("Повторный вход не отмечен");
  }
  return loginWrites.length;
};

const monitor = (name) =>
  `/var/spool/asterisk/monitor/${name}`;

const sampleCalls = () => {
  const internal = [
    {
      Event: "Newchannel",
      Channel: "SIP/109-0000004d",
      CallerIDNum: "109",
      Exten: "118",
      Context: "from-internal-crm",
      Uniqueid: "1793686207.95",
    },
    {
      Event: "VarSet",
      Variable: "__DIRECTCRM",
      Value: "internal",
      Uniqueid: "1793686207.95",
    },
    {
      Event: "VarSet",
      Variable: "__PERVIYNUMBER",
      Value: "118",
      Uniqueid: "1793686207.95",
    },
    {
      Event: "VarSet",
      Variable: "MIXMONITOR_FILENAME",
      Value: monitor("20261103-101007-109-118-1793686207.95-1793686207.95.wav"),
      Uniqueid: "1793686207.95",
    },
    {
      Event: "Dial",
      SubEvent: "Begin",
      Channel: "SIP/109-0000004d",
      Destination: "SIP/118-0000004e",
      UniqueID: "1793686207.95",
      DestUniqueID: "1793686207.96",
      Dialstring: "118",
    },
    {
      Event: "VarSet",
      Variable: "DIALEDPEERNUMBER",
      Value: "118",
      Uniqueid: "1793686207.95",
    },
    {
      Event: "Dial",
      SubEvent: "End",
      UniqueID: "1793686207.95",
      DialStatus: "ANSWER",
    },
    {
      Event: "VarSet",
      Variable: "ANSWEREDTIME",
      Value: "19",
      Uniqueid: "1793686207.95",
    },
    {
      Event: "VarSet",
      Variable: "DIALEDTIME",
      Value: "29",
      Uniqueid: "1793686207.95",
    },
    {
      Event: "Hangup",
      Uniqueid: "1793686207.95",
      Channel: "SIP/109-0000004d",
      CallerIDNum: "109",
      ConnectedLineNum: "118",
      Cause: "16",
    },
  ];

  const incoming = [
    {
      Event: "Newchannel",
      Channel: "SIP/beeline-0000004f",
      CallerIDNum: "+79374440569",
      Exten: "SIP01MXIU0068M",
      Context: "from-trunk-b",
      Uniqueid: "1793686314.97",
    },
    {
      Event: "VarSet",
      Variable: "__DIRECTCRM",
      Value: "incoming",
      Uniqueid: "1793686314.97",
    },
    {
      Event: "VarSet",
      Variable: "__PERVIYNUMBER",
      Value: "89374440569",
      Uniqueid: "1793686314.97",
    },
    {
      Event: "NewCallerid",
      CallerIDNum: "89374440569",
      Uniqueid: "1793686314.97",
    },
    {
      Event: "Newchannel",
      Channel: "Local/108@from-internal-00000009;1",
      Uniqueid: "1793686325.98",
    },
    {
      Event: "Newchannel",
      Channel: "Local/108@from-internal-00000009;2",
      Uniqueid: "1793686325.99",
    },
    {
      Event: "Dial",
      SubEvent: "Begin",
      Channel: "SIP/beeline-0000004f",
      Destination: "Local/108@from-internal-00000009;1",
      UniqueID: "1793686314.97",
      DestUniqueID: "1793686325.98",
      Dialstring: "108@from-internal",
      CallerIDNum: "89374440569",
    },
    {
      Event: "VarSet",
      Variable: "MIXMONITOR_FILENAME",
      Value: monitor(
        "20261103-101205-89374440569-108-g108-1793686325.99-1793686314.97.wav"
      ),
      Uniqueid: "1793686325.99",
    },
    {
      Event: "VarSet",
      Variable: "DIALEDPEERNUMBER",
      Value: "108@from-internal",
      Uniqueid: "1793686314.97",
    },
    {
      Event: "Dial",
      SubEvent: "End",
      UniqueID: "1793686314.97",
      DialStatus: "ANSWER",
    },
    {
      Event: "VarSet",
      Variable: "ANSWEREDTIME",
      Value: "138",
      Uniqueid: "1793686314.97",
    },
    {
      Event: "VarSet",
      Variable: "DIALEDTIME",
      Value: "155",
      Uniqueid: "1793686314.97",
    },
    {
      Event: "Hangup",
      Uniqueid: "1793686314.97",
      Channel: "SIP/beeline-0000004f",
      CallerIDNum: "89374440569",
      ConnectedLineNum: "108",
      Cause: "16",
    },
  ];

  const outgoing = [
    {
      Event: "Newchannel",
      Channel: "SIP/103-000000c7",
      CallerIDNum: "103",
      Exten: "89064058645",
      Context: "from-internal-crm",
      Uniqueid: "1793691610.277",
    },
    {
      Event: "VarSet",
      Variable: "__DIRECTCRM",
      Value: "outgoing",
      Uniqueid: "1793691610.277",
    },
    {
      Event: "VarSet",
      Variable: "__PERVIYNUMBER",
      Value: "89064058645",
      Uniqueid: "1793691610.277",
    },
    {
      Event: "VarSet",
      Variable: "MIXMONITOR_FILENAME",
      Value: monitor(
        "20261103-114010-103-89064058645-OUT103-1793691610.277-1793691610.277.wav"
      ),
      Uniqueid: "1793691610.277",
    },
    {
      Event: "Dial",
      SubEvent: "Begin",
      UniqueID: "1793691610.277",
      DestUniqueID: "1793691610.278",
      Dialstring: "beeline/89064058645",
      Destination: "SIP/beeline-000000c8",
    },
    {
      Event: "VarSet",
      Variable: "DIALEDPEERNUMBER",
      Value: "beeline/89064058645",
      Uniqueid: "1793691610.277",
    },
    {
      Event: "Dial",
      SubEvent: "End",
      UniqueID: "1793691610.277",
      DialStatus: "ANSWER",
    },
    {
      Event: "VarSet",
      Variable: "ANSWEREDTIME",
      Value: "38",
      Uniqueid: "1793691610.277",
    },
    {
      Event: "VarSet",
      Variable: "DIALEDTIME",
      Value: "51",
      Uniqueid: "1793691610.277",
    },
    {
      Event: "Hangup",
      Uniqueid: "1793691610.277",
      CallerIDNum: "103",
      ConnectedLineNum: "<unknown>",
      Cause: "16",
    },
  ];

  const missedQueue = [
    {
      Event: "Newchannel",
      Channel: "SIP/beeline-00000055",
      CallerIDNum: "+79656393030",
      Exten: "SIP01MXIU0068M",
      Context: "from-trunk-b",
      Uniqueid: "1793686455.105",
    },
    {
      Event: "VarSet",
      Variable: "__DIRECTCRM",
      Value: "incoming",
      Uniqueid: "1793686455.105",
    },
    {
      Event: "NewCallerid",
      CallerIDNum: "89656393030",
      Uniqueid: "1793686455.105",
    },
    {
      Event: "Dial",
      SubEvent: "Begin",
      UniqueID: "1793686455.105",
      DestUniqueID: "1793686466.107",
      Dialstring: "108@from-internal",
      Destination: "Local/108@from-internal-0000000a;1",
    },
    {
      Event: "Dial",
      SubEvent: "End",
      UniqueID: "1793686455.105",
      DialStatus: "NOANSWER",
    },
    { Event: "Join", Uniqueid: "1793686455.105" },
    {
      Event: "Newchannel",
      Channel: "Local/103@from-queue-0000000b;2",
      Uniqueid: "1793686478.109",
    },
    {
      Event: "VarSet",
      Variable: "MIXMONITOR_FILENAME",
      Value: monitor(
        "20261103-101438-89656393030-103-1793686478.109-1793686455.105.wav"
      ),
      Uniqueid: "1793686478.109",
    },
    {
      Event: "Hangup",
      Uniqueid: "1793686455.105",
      CallerIDNum: "89656393030",
      ConnectedLineNum: "106",
      Cause: "16",
    },
  ];

  return [...internal, ...incoming, ...outgoing, ...missedQueue];
};

const expectCard = (cards, uniqueid, expected) => {
  const card = cards.find((item) => item.uniqueid === uniqueid);
  if (!card) throw new Error(`Нет карточки ${uniqueid}`);
  for (const [key, value] of Object.entries(expected)) {
    const actual = card[key];
    const same =
      key === "recordingPath"
        ? String(actual || "").endsWith(value)
        : actual === value;
    if (!same) {
      throw new Error(
        `${uniqueid} ${key}: ожидалось ${value}, получено ${actual}`
      );
    }
  }
  return card;
};

const collectCards = () => {
  const cards = [];
  const tracker = createCallTracker({
    onDone: (card) => cards.push(card),
  });
  sampleCalls().forEach((fields) => tracker.feed(fields));
  return cards;
};

const printCards = (cards) => {
  cards.forEach((card) => {
    console.log(
      [
        card.direction,
        card.status,
        card.callerNumber,
        "->",
        card.receiverNumber || "—",
        "доб.",
        card.extension || "—",
        "разговор",
        card.talkSeconds,
        "с",
        card.uniqueid,
      ].join(" ")
    );
    if (card.recordingPath) console.log("  запись:", card.recordingPath);
  });
};

const writeCards = async (cards) => {
  const pool = new Pool({
    user: process.env.DB_USER || "postgres",
    host: process.env.DB_HOST || "localhost",
    database: process.env.DB_NAME || "Svarog",
    password: process.env.DB_PASSWORD || "postgres",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    connectionTimeoutMillis: 5000,
  });
  try {
    await ensureCallCardSchema(pool);
    for (const card of cards) {
      const id = await saveCallCard(pool, card);
      console.log(`В базе id ${id}, Uniqueid ${card.uniqueid}`);
    }
    console.log("Карточки записаны. Откройте принятые и пропущенные и обновите список.");
  } finally {
    await pool.end();
  }
};

const main = async () => {
  const loginCount = await checkLoginOnReconnect();
  console.log(`Повторный вход: пароль отправлен ${loginCount} раза`);

  const cards = collectCards();
  if (cards.length !== 4) {
    throw new Error(`Ожидалось 4 карточки, получено ${cards.length}`);
  }

  expectCard(cards, "1793686207.95", {
    direction: "internal",
    status: "accepted",
    callerNumber: "109",
    receiverNumber: "118",
    extension: "118",
    talkSeconds: 19,
    dialedSeconds: 29,
    recordingPath: "20261103-101007-109-118-1793686207.95-1793686207.95.wav",
  });
  expectCard(cards, "1793686314.97", {
    direction: "incoming",
    status: "accepted",
    callerNumber: "79374440569",
    receiverNumber: "108",
    extension: "108",
    talkSeconds: 138,
    dialedSeconds: 155,
    recordingPath: "1793686314.97.wav",
  });
  expectCard(cards, "1793691610.277", {
    direction: "outgoing",
    status: "accepted",
    callerNumber: "103",
    receiverNumber: "79064058645",
    extension: "103",
    talkSeconds: 38,
    dialedSeconds: 51,
    recordingPath: "OUT103-1793691610.277-1793691610.277.wav",
  });
  expectCard(cards, "1793686455.105", {
    direction: "incoming",
    status: "missed",
    callerNumber: "79656393030",
    receiverNumber: null,
    extension: null,
    talkSeconds: 0,
    recordingPath: "1793686455.105.wav",
  });

  console.log("Карточки совпали с образцом дня:");
  printCards(cards);

  if (process.argv.includes("--dry")) {
    console.log("База не изменялась.");
    return;
  }

  try {
    await writeCards(cards);
  } catch (error) {
    console.error("База недоступна, карточки на экране не появятся:", error.message);
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
