// Сборка карточки звонка из событий AMI.
// Образец: телефония/ami-capabilities-2026-11-03.json и события этого дня.
// Направление — __DIRECTCRM. Разговор — Uniqueid. Linkedid станция не шлёт.
// Длительность разговора — ANSWEREDTIME, вместе с гудками — DIALEDTIME.
// Первый Exten входящего с Билайн часто имя транка, не добавочный.

const { normalizePhone, shortExtension, externalNumber } = require("./phoneNumber");

const DIRECTIONS = new Set(["incoming", "outgoing", "internal"]);

const uniqueIdOf = (fields) => fields.Uniqueid || fields.UniqueID || null;

const localChannel = (channel) => {
  const match = String(channel || "").match(/^(Local\/.+);([12])$/);
  if (!match) return null;
  return { base: match[1], side: match[2] };
};

const createCallTracker = (handlers = {}) => {
  const legs = new Map();
  const recordings = new Map();
  const localSides = new Map();

  const emit = (handler, card) => {
    if (!handler || !card) return;
    try {
      const result = handler(card);
      if (result && typeof result.catch === "function") {
        result.catch((error) => {
          console.error("Ошибка обработки карточки звонка:", error.message);
        });
      }
    } catch (error) {
      console.error("Ошибка обработки карточки звонка:", error.message);
    }
  };

  const legOf = (uniqueid) => {
    if (!uniqueid) return null;
    if (!legs.has(uniqueid)) {
      legs.set(uniqueid, {
        uniqueid,
        channel: null,
        callerRaw: null,
        extenRaw: null,
        firstNumber: null,
        connectedRaw: null,
        direction: null,
        dialedPeer: null,
        dialString: null,
        dialedExtensions: [],
        answeredExtension: null,
        answered: false,
        queued: false,
        talkSeconds: null,
        dialedSeconds: null,
        recordingPath: null,
        parentId: null,
        localPeerId: null,
        startedAt: null,
      });
    }
    return legs.get(uniqueid);
  };

  const rememberLocal = (leg) => {
    const parsed = localChannel(leg.channel);
    if (!parsed) return;
    if (!localSides.has(parsed.base)) localSides.set(parsed.base, {});
    const pair = localSides.get(parsed.base);
    pair[parsed.side] = leg.uniqueid;
    const otherId = parsed.side === "1" ? pair["2"] : pair["1"];
    if (!otherId) return;
    const other = legs.get(otherId);
    leg.localPeerId = otherId;
    if (other) other.localPeerId = leg.uniqueid;
    const parentId = leg.parentId || (other && other.parentId);
    if (parentId) {
      if (!leg.parentId && !leg.direction) leg.parentId = parentId;
      if (other && !other.parentId && !other.direction) other.parentId = parentId;
    }
  };

  const assignParent = (childId, parentId) => {
    const child = legOf(childId);
    if (!child || child.direction) return;
    if (!child.parentId) child.parentId = parentId;
    if (child.localPeerId) {
      const peer = legs.get(child.localPeerId);
      if (peer && !peer.parentId && !peer.direction) peer.parentId = parentId;
    }
  };

  const findRoot = (leg) => {
    let current = leg;
    const seen = new Set();
    while (current && !seen.has(current.uniqueid)) {
      seen.add(current.uniqueid);
      if (!current.parentId) break;
      const parent = legs.get(current.parentId);
      if (!parent) break;
      current = parent;
    }
    return current || leg;
  };

  const noteExtension = (leg, value) => {
    const extension = shortExtension(value);
    if (!extension) return;
    if (!leg.dialedExtensions.includes(extension)) {
      leg.dialedExtensions.push(extension);
    }
    const root = findRoot(leg);
    if (root && root !== leg && !root.dialedExtensions.includes(extension)) {
      root.dialedExtensions.push(extension);
    }
  };

  const noteRecording = (uniqueid, filePath) => {
    if (!filePath) return;
    const ids = String(filePath).match(/\d+\.\d+/g) || [];
    recordings.set(uniqueid, filePath);
    ids.forEach((id) => recordings.set(id, filePath));
  };

  const assignCaller = (leg, value) => {
    const next = normalizePhone(value);
    if (!next) return;
    if (leg.direction === "incoming" && leg.callerRaw) {
      const current = normalizePhone(leg.callerRaw);
      if (current && current.length > 5 && next.length <= 5) return;
    }
    leg.callerRaw = value;
  };

  const markAnswered = (leg, extension) => {
    const root = findRoot(leg);
    root.answered = true;
    if (extension) root.answeredExtension = extension;
  };

  const buildCard = (leg) => {
    const answered = Boolean(leg.answered) || leg.talkSeconds > 0;
    let extension = leg.answeredExtension;
    if (!extension && answered) {
      extension =
        shortExtension(leg.dialedPeer) ||
        shortExtension(leg.dialString) ||
        shortExtension(leg.connectedRaw);
    }
    if (!extension && !answered && !leg.queued && leg.dialedExtensions.length === 1) {
      extension = leg.dialedExtensions[0];
    }

    let callerNumber = null;
    let receiverNumber = null;

    if (leg.direction === "incoming") {
      callerNumber = externalNumber(leg.callerRaw, leg.firstNumber);
      receiverNumber = extension;
    } else if (leg.direction === "outgoing") {
      callerNumber = shortExtension(leg.callerRaw) || shortExtension(leg.channel);
      receiverNumber = externalNumber(leg.firstNumber, leg.extenRaw, leg.dialedPeer);
      extension = callerNumber;
    } else {
      callerNumber = shortExtension(leg.callerRaw) || shortExtension(leg.channel);
      receiverNumber = extension || shortExtension(leg.extenRaw);
      extension = receiverNumber;
    }

    const recordingPath = leg.recordingPath || recordings.get(leg.uniqueid) || null;

    return {
      uniqueid: leg.uniqueid,
      direction: leg.direction,
      callerNumber,
      receiverNumber,
      extension: extension || null,
      talkSeconds: leg.talkSeconds == null ? (answered ? null : 0) : leg.talkSeconds,
      dialedSeconds: leg.dialedSeconds == null ? null : leg.dialedSeconds,
      recordingPath,
      answered,
      status: answered ? "accepted" : "missed",
      startedAt: leg.startedAt || new Date(),
      channel: leg.channel,
    };
  };

  const feed = (fields) => {
    if (!fields) return;
    try {
      apply(fields);
    } catch (error) {
      console.error("Ошибка разбора события звонка:", error.message);
    }
  };

  const apply = (fields) => {
    const event = fields.Event;
    if (!event) return;
    const uniqueid = uniqueIdOf(fields);

    if (event === "Newchannel") {
      const leg = legOf(uniqueid);
      if (!leg) return;
      leg.channel = fields.Channel || leg.channel;
      leg.extenRaw = fields.Exten || leg.extenRaw;
      leg.startedAt = leg.startedAt || new Date();
      assignCaller(leg, fields.CallerIDNum);
      rememberLocal(leg);
      return;
    }

    if (event === "NewCallerid" || event === "Newstate") {
      const leg = legOf(uniqueid);
      if (!leg) return;
      assignCaller(leg, fields.CallerIDNum);
      if (fields.ConnectedLineNum) leg.connectedRaw = fields.ConnectedLineNum;
      if (fields.Channel) leg.channel = fields.Channel;
      rememberLocal(leg);
      return;
    }

    if (event === "VarSet") {
      const leg = legOf(uniqueid);
      if (!leg) return;
      const name = fields.Variable;
      const value = fields.Value;
      if (name === "__DIRECTCRM" && DIRECTIONS.has(value)) {
        leg.direction = value;
      } else if (name === "__PERVIYNUMBER" && value) {
        leg.firstNumber = value;
      } else if (name === "DIALEDPEERNUMBER" && value) {
        leg.dialedPeer = value;
        noteExtension(leg, value);
      } else if (name === "ANSWEREDTIME" && value !== "" && value != null) {
        const seconds = Number(value);
        if (Number.isFinite(seconds)) leg.talkSeconds = seconds;
      } else if (name === "DIALEDTIME" && value !== "" && value != null) {
        const seconds = Number(value);
        if (Number.isFinite(seconds)) leg.dialedSeconds = seconds;
      } else if (name === "MIXMONITOR_FILENAME" && value) {
        leg.recordingPath = value;
        noteRecording(uniqueid, value);
      } else if (name === "CDR(userfield)" && value && !leg.recordingPath) {
        const audio = String(value).match(/audio:(.+\.wav)/i);
        if (audio) {
          leg.recordingPath = `/var/spool/asterisk/monitor/${audio[1]}`;
          noteRecording(uniqueid, leg.recordingPath);
        }
      }
      if (leg.direction) emit(handlers.onProgress, buildCard(leg));
      return;
    }

    if (event === "Dial" && fields.SubEvent === "Begin") {
      const parent = legOf(fields.UniqueID || fields.Uniqueid);
      const destId = fields.DestUniqueID;
      if (parent && destId) assignParent(destId, parent.uniqueid);
      if (parent) {
        parent.dialString = fields.Dialstring || parent.dialString;
        noteExtension(parent, fields.Dialstring);
        noteExtension(parent, fields.Destination);
        if (parent.direction) emit(handlers.onProgress, buildCard(parent));
      }
      return;
    }

    if (event === "Dial" && fields.SubEvent === "End") {
      const leg = legOf(fields.UniqueID || fields.Uniqueid);
      if (!leg) return;
      leg.dialStatus = fields.DialStatus;
      if (fields.DialStatus === "ANSWER") {
        const extension =
          shortExtension(leg.dialedPeer) ||
          shortExtension(leg.dialString) ||
          shortExtension(fields.Dialstring);
        markAnswered(leg, extension);
        const root = findRoot(leg);
        if (root && root.direction) emit(handlers.onProgress, buildCard(root));
      }
      return;
    }

    if (event === "Join") {
      const leg = legOf(uniqueid);
      if (!leg) return;
      findRoot(leg).queued = true;
      leg.queued = true;
      return;
    }

    if (event === "Hangup") {
      const leg = legOf(uniqueid);
      if (!leg) return;
      if (fields.ConnectedLineNum) leg.connectedRaw = fields.ConnectedLineNum;
      if (fields.Channel) leg.channel = fields.Channel;
      if (leg.direction) emit(handlers.onDone, buildCard(leg));
      legs.delete(uniqueid);
      recordings.delete(uniqueid);
    }
  };

  return { feed };
};

module.exports = {
  createCallTracker,
};
