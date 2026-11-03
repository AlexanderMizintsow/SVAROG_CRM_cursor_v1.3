// Журнал событий АТС. На запись звонков в базу не влияет.
// Пароль AMI сюда не попадает: чувствительные поля вырезаются.
//
// Файлы за сутки (каталог logs рядом с этим файлом, либо AMI_DIAG_DIR):
//   ami-events-ГГГГ-ММ-ДД.partNN.jsonl  — каждое событие и служебные отметки
//   ami-catalog-ГГГГ-ММ-ДД.json         — какие события и поля реально пришли
//   ami-capabilities-ГГГГ-ММ-ДД.json    — сводка: очереди, запись, переводы, форматы номеров
//   КАК-ПЕРЕДАТЬ.txt
//
// Выключить: AMI_DIAG_ENABLED=0
// Потолок за сутки: AMI_DIAG_DAY_BYTES (по умолчанию 2 ГБ)
// Размер одной части: AMI_DIAG_PART_BYTES (по умолчанию 80 МБ)

const fs = require("fs");
const os = require("os");
const path = require("path");

const ENABLED = process.env.AMI_DIAG_ENABLED !== "0";
const LOG_DIR =
  process.env.AMI_DIAG_DIR || path.join(__dirname, "logs");
const PART_MAX_BYTES =
  Number(process.env.AMI_DIAG_PART_BYTES) || 80 * 1024 * 1024;
const DAY_MAX_BYTES =
  Number(process.env.AMI_DIAG_DAY_BYTES) || 2 * 1024 * 1024 * 1024;
const CATALOG_EVERY_MS = 20000;
const HEARTBEAT_EVERY_MS = 60000;
const SENSITIVE_KEY =
  /secret|password|passwd|md5|authtoken|token|^key$|authorization/i;

const dayStamp = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
};

const first = (value) => {
  if (Array.isArray(value)) return value[0];
  return value;
};

const bump = (map, key, limit = 400) => {
  if (key === undefined || key === null || key === "") return;
  const name = String(key).slice(0, 180);
  if (map[name]) {
    map[name] += 1;
    return;
  }
  if (Object.keys(map).length >= limit) {
    map.__other = (map.__other || 0) + 1;
    return;
  }
  map[name] = 1;
};

const numberShape = (value) => {
  if (value === undefined || value === null || value === "") return "empty";
  const raw = String(value);
  if (/unknown|anonymous|private|restricted|unavailable/i.test(raw)) {
    return "hidden";
  }
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "non-digit";
  if (digits.length <= 5) return `short-${digits.length}`;
  if (raw.trim().startsWith("+")) return `plus-${digits.length}`;
  if (digits.length === 11 && digits.startsWith("8")) return "11-starts-8";
  if (digits.length === 11 && digits.startsWith("7")) return "11-starts-7";
  return `digits-${digits.length}`;
};

const channelTech = (channel) => {
  if (!channel) return null;
  const match = String(channel).match(/^([A-Za-z0-9]+)\//);
  return match ? match[1] : "no-tech";
};

const redact = (value, depth = 0) => {
  if (value === null || value === undefined) return value;
  if (depth > 8) return "[depth]";
  if (typeof value === "string") {
    if (value.length > 12000) return `${value.slice(0, 12000)}…[truncated]`;
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 80).map((item) => redact(item, depth + 1));
  }
  if (typeof value === "object") {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = SENSITIVE_KEY.test(key)
        ? "[redacted]"
        : redact(nested, depth + 1);
    }
    return out;
  }
  return String(value);
};

const emptyCatalog = () => ({
  startedAt: new Date().toISOString(),
  events: {},
  responses: {},
  traces: {},
});

const emptyCapabilities = () => ({
  startedAt: new Date().toISOString(),
  signals: {
    uniqueid: false,
    linkedid: false,
    connectedLine: false,
    queue: false,
    recording: false,
    transfer: false,
    cdr: false,
    hold: false,
    dtmf: false,
    conference: false,
    voicemail: false,
    dial: false,
    bridge: false,
    originate: false,
    attendedTransfer: false,
    blindTransfer: false,
  },
  privileges: {},
  contexts: {},
  applications: {},
  events: {},
  dialStatus: {},
  channelState: {},
  hangupCause: {},
  hangupCauseText: {},
  channelTechnologies: {},
  numberShapes: {},
  contextAndNumber: {},
  variableNames: {},
  accountCodes: {},
  bridgeTypes: {},
  extenValuesShort: {},
  durations: {},
  recording: {
    fields: {},
    formats: {},
    examples: [],
  },
  control: {
    probeSent: false,
    probeCount: 0,
    probeResult: null,
    probeMessage: null,
    amiCommands: {},
    routingApplications: {},
    routingExamples: [],
    queues: {},
    forwardVariables: {},
    stateEvents: {},
    targets: {},
  },
});

const state = {
  enabled: ENABLED,
  buffer: "",
  day: dayStamp(),
  part: 1,
  partBytes: 0,
  dayBytes: 0,
  stopped: !ENABLED,
  stream: null,
  catalog: emptyCatalog(),
  capabilities: emptyCapabilities(),
  counts: {
    chunks: 0,
    messages: 0,
    parseErrors: 0,
    bufferResets: 0,
  },
  loggedWriteError: false,
};

const eventsPath = () =>
  path.join(
    LOG_DIR,
    `ami-events-${state.day}.part${String(state.part).padStart(2, "0")}.jsonl`
  );

const writeHowTo = () => {
  const text = [
    "Журнал телефонии за рабочий день.",
    "",
    "Передайте одним архивом все файлы ami-* за нужную дату:",
    "  ami-events-....jsonl       каждое событие АТС и отметки программы",
    "  ami-catalog-....json       список событий и их полей",
    "  ami-capabilities-....json  сводка возможностей: очереди, путь и формат записи разговора, длительности, переводы",
    "",
    "Пароль AMI в эти файлы не пишется.",
    "Запись звонков в базу этот журнал не меняет.",
    "В файлах есть номера телефонов — это внутренние данные.",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(LOG_DIR, "КАК-ПЕРЕДАТЬ.txt"), text, "utf8");
};

const openStream = () => {
  state.stream = fs.createWriteStream(eventsPath(), { flags: "a" });
  state.stream.on("error", (error) => {
    state.stopped = true;
    if (!state.loggedWriteError) {
      state.loggedWriteError = true;
      console.error(
        "AMI-диагностика: ошибка записи журнала:",
        error.message
      );
    }
  });
};

const flushCatalog = () => {
  if (!state.enabled) return;
  try {
    const catalogPath = path.join(LOG_DIR, `ami-catalog-${state.day}.json`);
    const capabilitiesPath = path.join(
      LOG_DIR,
      `ami-capabilities-${state.day}.json`
    );
    const catalog = {
      ...state.catalog,
      updatedAt: new Date().toISOString(),
      counts: state.counts,
      dayBytes: state.dayBytes,
      part: state.part,
      stopped: state.stopped,
    };
    const capabilities = {
      ...state.capabilities,
      updatedAt: new Date().toISOString(),
      counts: state.counts,
    };
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), "utf8");
    fs.writeFileSync(
      capabilitiesPath,
      JSON.stringify(capabilities, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("AMI-диагностика: не удалось обновить сводку:", error.message);
  }
};

const rotatePart = () => {
  const previous = state.stream;
  state.part += 1;
  state.partBytes = 0;
  openStream();
  if (previous) previous.end();
};

const rollDay = () => {
  const nextDay = dayStamp();
  if (nextDay === state.day) return;
  flushCatalog();
  if (state.stream) state.stream.end();
  state.day = nextDay;
  state.part = 1;
  state.partBytes = 0;
  state.dayBytes = 0;
  state.stopped = false;
  state.catalog = emptyCatalog();
  state.capabilities = emptyCapabilities();
  state.counts = {
    chunks: 0,
    messages: 0,
    parseErrors: 0,
    bufferResets: 0,
  };
  openStream();
};

const writeRecord = (record) => {
  if (!state.enabled || state.stopped) return;
  rollDay();
  if (state.stopped) return;
  let line;
  try {
    line = `${JSON.stringify(record)}\n`;
  } catch (error) {
    state.counts.parseErrors += 1;
    return;
  }
  const bytes = Buffer.byteLength(line);
  if (state.dayBytes + bytes > DAY_MAX_BYTES) {
    state.stopped = true;
    console.error(
      "AMI-диагностика: достигнут суточный предел размера, запись журнала остановлена."
    );
    flushCatalog();
    return;
  }
  if (state.partBytes + bytes > PART_MAX_BYTES) {
    rotatePart();
  }
  state.stream.write(line);
  state.partBytes += bytes;
  state.dayBytes += bytes;
};

const DURATION_KEY = /duration|billsec|billable|talktime|holdtime/i;
const AUDIO_EXT = /\.(wav|mp3|gsm|ogg|sln16?|wav49|ulaw|alaw|g722)\b/i;
const PATH_LIKE =
  /(?:\/|\\|[A-Za-z]:\\)[^\s,;|"]+\.(?:wav|mp3|gsm|ogg|sln16?|wav49)/i;

const flattenValues = (value, acc = []) => {
  if (value === undefined || value === null) return acc;
  if (Array.isArray(value)) {
    value.forEach((item) => flattenValues(item, acc));
    return acc;
  }
  acc.push(String(value));
  return acc;
};

const parseSeconds = (raw) => {
  const text = String(raw).trim();
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  const clock = text.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (!clock) return null;
  return Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
};

const durationBucket = (seconds) => {
  if (seconds < 5) return "0-5s";
  if (seconds < 15) return "5-15s";
  if (seconds < 30) return "15-30s";
  if (seconds < 60) return "30-60s";
  if (seconds < 180) return "1-3min";
  if (seconds < 600) return "3-10min";
  return "10min+";
};

const noteDuration = (source, raw) => {
  const seconds = parseSeconds(raw);
  if (seconds === null || seconds < 0 || seconds > 86400) return;
  const stats = state.capabilities.durations;
  if (!stats[source]) {
    stats[source] = {
      count: 0,
      min: seconds,
      max: seconds,
      sum: 0,
      buckets: {},
    };
  }
  const entry = stats[source];
  entry.count += 1;
  entry.min = Math.min(entry.min, seconds);
  entry.max = Math.max(entry.max, seconds);
  entry.sum += seconds;
  const bucket = durationBucket(seconds);
  entry.buckets[bucket] = (entry.buckets[bucket] || 0) + 1;
};

const noteRecording = (eventName, fieldName, raw) => {
  const text = String(raw);
  const named =
    /mixmonitor|monitor|recording|recordfile/i.test(fieldName) ||
    /mixmonitor|monitor\(|stopmonitor|record\(/i.test(text);
  const audio = text.match(AUDIO_EXT);
  const filePath = text.match(PATH_LIKE);
  if (!named && !audio && !filePath) return;

  const cap = state.capabilities;
  cap.signals.recording = true;
  bump(cap.recording.fields, `${eventName || "event"}.${fieldName}`, 200);
  if (audio) bump(cap.recording.formats, audio[1].toLowerCase(), 20);
  if (!filePath && !audio) return;
  const sample = (filePath ? filePath[0] : text).slice(0, 300);
  if (
    !cap.recording.examples.includes(sample) &&
    cap.recording.examples.length < 40
  ) {
    cap.recording.examples.push(sample);
  }
};

const ROUTING_APPS =
  /^(Dial|Queue|Goto|Gosub|GotoIf|Transfer|Macro|VoiceMail|Busy|Congestion|ChanSpy|ExtenSpy|FollowMe|Pickup|Page|ConfBridge|AgentRequest|RetryDial|DISA|BackGround|Background)$/i;
const FORWARD_KEY =
  /CF|FORWARD|DEVICE_STATE|EXTENSION_STATE|PRESENCE|DND|PAUSE|BUSY/i;
const STATE_EVENTS =
  /^(ExtensionStatus|DeviceStateChange|PresenceStateChange|PeerStatus|QueueMemberStatus|QueueMember|QueueCallerJoin|AgentCalled|AgentConnect|AgentComplete|BlindTransfer|AttendedTransfer|DialBegin|DialEnd|HangupRequest|Redirect|OriginateResponse|Newstate)$/;

const noteControl = (eventName, fields) => {
  const ctrl = state.capabilities.control;
  if (!ctrl) return;

  if (eventName === "ListCommands") {
    const command = first(fields.Command) || first(fields.Action);
    if (command) bump(ctrl.amiCommands, command, 400);
  }
  if (first(fields.ActionID) === "diag-list-commands" && fields.Response) {
    ctrl.probeResult = first(fields.Response);
    if (fields.Message) {
      ctrl.probeMessage = String(first(fields.Message)).slice(0, 200);
    }
  }

  const app = String(first(fields.Application) || "");
  if (ROUTING_APPS.test(app)) {
    bump(ctrl.routingApplications, app, 80);
    const data = first(fields.AppData) || first(fields.Data) || first(fields.DestExten);
    if (data) {
      const sample = `${app}: ${String(data).slice(0, 240)}`;
      if (
        !ctrl.routingExamples.includes(sample) &&
        ctrl.routingExamples.length < 50
      ) {
        ctrl.routingExamples.push(sample);
      }
    }
  }

  if (STATE_EVENTS.test(String(eventName || ""))) {
    bump(ctrl.stateEvents, eventName, 80);
  }
  if (fields.Queue) bump(ctrl.queues, first(fields.Queue), 50);

  ["TransferTarget", "Transferee", "Extension", "DestExten", "Interface", "MemberName"].forEach(
    (key) => {
      if (!fields[key]) return;
      if (!/transfer|queue|agent|dial|redirect/i.test(`${eventName} ${key}`)) return;
      bump(
        ctrl.targets,
        `${eventName || "event"}.${key}:${String(first(fields[key])).slice(0, 80)}`,
        100
      );
    }
  );

  if (fields.Variable && FORWARD_KEY.test(String(first(fields.Variable)))) {
    bump(
      ctrl.forwardVariables,
      `${first(fields.Variable)}=${String(first(fields.Value) || "").slice(0, 80)}`,
      80
    );
  }
};

const rememberMessage = (parsed) => {
  const fields = parsed.fields || {};
  const eventName = first(fields.Event);
  const responseName = first(fields.Response);
  const bucketName = eventName || (responseName ? `Response:${responseName}` : "unknown");
  const bucket = eventName ? state.catalog.events : state.catalog.responses;
  const key = eventName || responseName || "unknown";
  if (!bucket[key]) {
    bucket[key] = {
      count: 0,
      fields: {},
      example: redact(fields),
    };
  }
  const entry = bucket[key];
  entry.count += 1;
  for (const fieldName of Object.keys(fields)) {
    entry.fields[fieldName] = (entry.fields[fieldName] || 0) + 1;
  }

  const cap = state.capabilities;
  bump(cap.events, bucketName);
  if (fields.Privilege) bump(cap.privileges, first(fields.Privilege));
  if (fields.Context) bump(cap.contexts, first(fields.Context));
  if (fields.Application) bump(cap.applications, first(fields.Application));
  if (fields.DialStatus) bump(cap.dialStatus, first(fields.DialStatus));
  if (fields.ChannelStateDesc) {
    bump(cap.channelState, first(fields.ChannelStateDesc));
  }
  if (fields.Cause) bump(cap.hangupCause, first(fields.Cause));
  if (fields["Cause-txt"]) bump(cap.hangupCauseText, first(fields["Cause-txt"]));
  if (fields.AccountCode) bump(cap.accountCodes, first(fields.AccountCode));
  if (fields.BridgeType || fields.BridgeTechnology) {
    bump(
      cap.bridgeTypes,
      first(fields.BridgeType) || first(fields.BridgeTechnology)
    );
  }
  if (fields.Variable) bump(cap.variableNames, first(fields.Variable), 500);

  const channels = [
    fields.Channel,
    fields.DestChannel,
    fields.Destination,
    fields.Source,
    fields.Channel1,
    fields.Channel2,
    fields.OrigChannel,
  ];
  channels.forEach((channel) => {
    const tech = channelTech(first(channel));
    if (tech) bump(cap.channelTechnologies, tech);
  });

  const numberFields = [
    "CallerIDNum",
    "CallerIDName",
    "ConnectedLineNum",
    "ConnectedLineName",
    "DestCallerIDNum",
    "DestExten",
    "Exten",
    "Extension",
    "DialString",
    "Interface",
  ];
  numberFields.forEach((fieldName) => {
    if (!fields[fieldName]) return;
    const raw = first(fields[fieldName]);
    const shape = numberShape(raw);
    bump(cap.numberShapes, `${fieldName}:${shape}`);
    if (fieldName === "Exten" && String(raw).length <= 6) {
      bump(cap.extenValuesShort, raw, 300);
    }
  });

  if (fields.Context && fields.Exten) {
    bump(
      cap.contextAndNumber,
      `${first(fields.Context)} + ${numberShape(first(fields.Exten))}`
    );
  }

  const eventText = String(eventName || "");
  const appText = String(first(fields.Application) || "");
  const blob = `${eventText} ${appText}`.toLowerCase();
  if (fields.Uniqueid) cap.signals.uniqueid = true;
  if (fields.Linkedid) cap.signals.linkedid = true;
  if (fields.ConnectedLineNum) cap.signals.connectedLine = true;
  if (blob.includes("queue")) cap.signals.queue = true;
  if (blob.includes("mixmonitor") || blob.includes("record")) {
    cap.signals.recording = true;
  }
  if (blob.includes("transfer")) cap.signals.transfer = true;
  if (blob.includes("attended")) cap.signals.attendedTransfer = true;
  if (blob.includes("blind")) cap.signals.blindTransfer = true;
  if (blob.includes("cdr")) cap.signals.cdr = true;
  if (blob.includes("hold")) cap.signals.hold = true;
  if (blob.includes("dtmf")) cap.signals.dtmf = true;
  if (blob.includes("conf")) cap.signals.conference = true;
  if (blob.includes("voicemail") || blob.includes("voice")) {
    cap.signals.voicemail = true;
  }
  if (blob.includes("dial")) cap.signals.dial = true;
  if (blob.includes("bridge")) cap.signals.bridge = true;
  if (blob.includes("originate")) cap.signals.originate = true;
  noteControl(eventName, fields);

  Object.entries(fields).forEach(([fieldName, value]) => {
    flattenValues(value).forEach((raw) => {
      if (DURATION_KEY.test(fieldName)) {
        noteDuration(`${eventName || "event"}.${fieldName}`, raw);
      }
      noteRecording(eventName, fieldName, raw);
    });
  });
};

const consumeBlock = (block) => {
  const text = block.trim();
  if (!text) return;
  const fields = {};
  const extraLines = [];
  text.split("\n").forEach((line) => {
    if (!line) return;
    const separator = line.indexOf(":");
    if (separator === -1) {
      extraLines.push(line.slice(0, 500));
      return;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!key) return;
    if (fields[key] === undefined) {
      fields[key] = value;
    } else if (Array.isArray(fields[key])) {
      fields[key].push(value);
    } else {
      fields[key] = [fields[key], value];
    }
  });

  const safeFields = redact(fields);
  const record = {
    ts: new Date().toISOString(),
    kind: "ami",
    event: first(safeFields.Event) || null,
    response: first(safeFields.Response) || null,
    fields: safeFields,
  };
  if (extraLines.length) record.extraLines = extraLines;
  writeRecord(record);
  state.counts.messages += 1;
  try {
    rememberMessage({ fields });
  } catch (error) {
    state.counts.parseErrors += 1;
  }
};

const flushPartial = (reason) => {
  if (!state.enabled || state.stopped) return;
  const pending = state.buffer.trim();
  state.buffer = "";
  if (!pending) return;
  writeRecord({
    ts: new Date().toISOString(),
    kind: "partial",
    reason: reason || "flush",
    text: pending.slice(0, 20000),
  });
};

const ingestChunk = (chunk) => {
  if (!state.enabled || state.stopped) return;
  try {
    state.counts.chunks += 1;
    const text = chunk
      .toString("utf8")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");
    state.buffer += text;
    if (state.buffer.length > 8 * 1024 * 1024) {
      state.counts.bufferResets += 1;
      state.buffer = "";
      writeRecord({
        ts: new Date().toISOString(),
        kind: "trace",
        name: "buffer_overflow_reset",
      });
      return;
    }
    let splitAt = state.buffer.indexOf("\n\n");
    while (splitAt !== -1) {
      const block = state.buffer.slice(0, splitAt);
      state.buffer = state.buffer.slice(splitAt + 2);
      consumeBlock(block);
      splitAt = state.buffer.indexOf("\n\n");
    }
  } catch (error) {
    state.counts.parseErrors += 1;
  }
};

const trace = (name, details) => {
  if (!state.enabled || state.stopped) return;
  try {
    state.catalog.traces[name] = (state.catalog.traces[name] || 0) + 1;
    if (name === "parser_hangup" && details && details.duration !== undefined) {
      noteDuration("parser.hangup", details.duration);
    }
    writeRecord({
      ts: new Date().toISOString(),
      kind: "trace",
      name,
      details: redact(details || {}),
    });
  } catch (error) {
    state.counts.parseErrors += 1;
  }
};

if (ENABLED) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    writeHowTo();
    openStream();
    trace("logger_started", {
      logDir: LOG_DIR,
      pid: process.pid,
      hostname: os.hostname(),
      cwd: process.cwd(),
      node: process.version,
      platform: process.platform,
      partMaxBytes: PART_MAX_BYTES,
      dayMaxBytes: DAY_MAX_BYTES,
    });
    console.log(`AMI-диагностика: журнал пишется в ${LOG_DIR}`);
    const catalogTimer = setInterval(flushCatalog, CATALOG_EVERY_MS);
    const heartbeatTimer = setInterval(() => {
      trace("heartbeat", {
        chunks: state.counts.chunks,
        messages: state.counts.messages,
        parseErrors: state.counts.parseErrors,
        bufferResets: state.counts.bufferResets,
        bufferLength: state.buffer.length,
        dayBytes: state.dayBytes,
        part: state.part,
        eventTypes: Object.keys(state.catalog.events).length,
      });
      flushCatalog();
    }, HEARTBEAT_EVERY_MS);
    if (catalogTimer.unref) catalogTimer.unref();
    if (heartbeatTimer.unref) heartbeatTimer.unref();
    let shuttingDown = false;
    const saveAndExit = () => {
      if (shuttingDown) return;
      shuttingDown = true;
      state.stopped = true;
      flushCatalog();
      const stream = state.stream;
      state.stream = null;
      if (!stream) {
        process.exit(0);
        return;
      }
      const forceExit = setTimeout(() => process.exit(0), 1000);
      stream.end(() => {
        clearTimeout(forceExit);
        process.exit(0);
      });
    };
    process.on("exit", () => {
      try {
        flushCatalog();
      } catch (error) {
        // На выходе процесс уже завершается.
      }
    });
    process.on("SIGINT", saveAndExit);
    process.on("SIGTERM", saveAndExit);
  } catch (error) {
    state.stopped = true;
    console.error("AMI-диагностика: не удалось запустить журнал:", error.message);
  }
}

const controlProbePacket = () => {
  if (!ENABLED || state.stopped) return "";
  try {
    state.capabilities.control.probeSent = true;
    state.capabilities.control.probeCount += 1;
    trace("control_probe_sent", { action: "ListCommands" });
  } catch (error) {
    state.counts.parseErrors += 1;
  }
  return "Action: ListCommands\r\nActionID: diag-list-commands\r\n\r\n";
};

module.exports = {
  ingestChunk,
  trace,
  flushCatalog,
  flushPartial,
  controlProbePacket,
  logDir: LOG_DIR,
  enabled: ENABLED,
};
