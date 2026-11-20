// Прослушивание записи и отметка короткого или длинного разговора.
// Файл отдаётся, только если папка записей видна этому серверу.

const fs = require("fs");
const path = require("path");
const { ensureCallCardSchema } = require("../asterisk_server/callCardStore");
const { noteWork } = require("../asterisk_server/workLog");
const { canEditMissedMinutes, headedDepartmentIds } = require("./callDay");
const { loadViewer } = require("./callStats");

const ASTERISK_MONITOR = "/var/spool/asterisk/monitor";
const LOCAL_MONITOR = path.join(__dirname, "call-recordings");

const recordingsRoot = () => {
  const fromEnv = process.env.CALL_RECORDINGS_DIR;
  if (fromEnv && fs.existsSync(fromEnv)) return path.resolve(fromEnv);
  if (fs.existsSync(ASTERISK_MONITOR)) return ASTERISK_MONITOR;
  if (fs.existsSync(LOCAL_MONITOR)) return LOCAL_MONITOR;
  return null;
};

const recordingFile = (recordingPath) => {
  const root = recordingsRoot();
  if (!root || !recordingPath) return null;
  const base = path.basename(String(recordingPath).replace(/\\/g, "/"));
  if (!/^[\w.-]+\.wav$/i.test(base)) return null;
  const full = path.resolve(root, base);
  const relative = path.relative(root, full);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  try {
    if (!fs.statSync(full).isFile()) return null;
  } catch (error) {
    return null;
  }
  return full;
};

const talkMark = (seconds, shortSeconds, longSeconds) => {
  const talk = Number(seconds);
  if (!Number.isFinite(talk) || talk <= 0) return null;
  if (talk <= shortSeconds) return "short";
  if (talk >= longSeconds) return "long";
  return null;
};

const getTalkMarks = async (pool) => {
  await ensureCallCardSchema(pool);
  const result = await pool.query(
    `SELECT short_seconds, long_seconds
     FROM telephony_day_settings WHERE id = 1`
  );
  const row = result.rows[0] || {};
  return {
    shortSeconds: row.short_seconds || 30,
    longSeconds: row.long_seconds || 180,
  };
};

const loadListener = async (pool, userId) => {
  const viewer = await loadViewer(pool, userId);
  if (!viewer) return null;
  const headed = await headedDepartmentIds(pool, userId, viewer);
  return {
    id: userId,
    departmentId: viewer.department_id,
    showCallStats: Boolean(viewer.show_call_stats),
    isAdmin: viewer.role_name === "Администратор",
    isDirector: viewer.role_name === "Директор",
    headed,
  };
};

const canListen = (listener, call) => {
  if (!listener || !call) return false;
  const managerId = call.manager_user_id == null ? null : Number(call.manager_user_id);
  const departmentId =
    call.manager_department_id == null ? null : Number(call.manager_department_id);
  if (managerId && listener.id === managerId) return true;
  if (managerId && departmentId != null && listener.headed.has(departmentId)) return true;
  if (!listener.showCallStats) return false;
  if (listener.isAdmin || listener.isDirector) return true;
  return Boolean(
    listener.departmentId && departmentId && listener.departmentId === departmentId
  );
};

const decorateCompanyCalls = async (pool, userId, rows) => {
  const marks = await getTalkMarks(pool);
  const listener = userId ? await loadListener(pool, userId) : null;
  rows.forEach((row) => {
    row.talk_mark = talkMark(row.talk_seconds, marks.shortSeconds, marks.longSeconds);
    row.can_play = Boolean(listener && canListen(listener, row) && recordingFile(row.recording_path));
    delete row.recording_path;
    delete row.manager_department_id;
  });
  return rows;
};

const callAccessRow = async (pool, callId) => {
  const result = await pool.query(
    `SELECT c.id, c.recording_path, c.talk_seconds,
            manager.manager_user_id, manager.manager_department_id
     FROM calls c
     LEFT JOIN LATERAL (
       SELECT u.id AS manager_user_id, u.department_id AS manager_department_id
       FROM user_phones up
       JOIN users u ON u.id = up.user_id
       WHERE phone_key(up.phone_number) = phone_key(
         COALESCE(NULLIF(btrim(c.extension), ''), c.receiver_number, c.caller_number)
       )
       ORDER BY u.id
       LIMIT 1
     ) manager ON true
     WHERE c.id = $1`,
    [callId]
  );
  return result.rows[0] || null;
};

const missingRecordingNoted = new Set();

const openRecording = async (pool, userId, callId) => {
  await ensureCallCardSchema(pool);
  const call = await callAccessRow(pool, callId);
  if (!call) return { status: 404, error: "Звонок не найден" };
  const listener = await loadListener(pool, userId);
  if (!listener) return { status: 404, error: "Пользователь не найден" };
  if (!canListen(listener, call)) {
    return { status: 403, error: "Эту запись слушать нельзя" };
  }
  const file = recordingFile(call.recording_path);
  if (!file) {
    if (call.recording_path && !missingRecordingNoted.has(call.id)) {
      missingRecordingNoted.add(call.id);
      noteWork(pool, {
        process: "CRM-server",
        kind: "mismatch",
        message: "В карточке есть запись, файла на диске нет",
        detail: `звонок ${call.id}`,
      });
    }
    return { status: 404, error: "Файл записи сейчас недоступен" };
  }
  try {
    await pool.query(
      `INSERT INTO call_recording_plays (call_id, user_id) VALUES ($1, $2)`,
      [callId, userId]
    );
  } catch (error) {
    console.error("Не удалось записать прослушивание:", error.message);
  }
  return { file };
};

const saveTalkMarks = async (pool, userId, shortSeconds, longSeconds) => {
  await ensureCallCardSchema(pool);
  const viewer = await loadViewer(pool, userId);
  if (!viewer) return { status: 404, error: "Пользователь не найден" };
  if (!canEditMissedMinutes(viewer)) {
    return { status: 403, error: "Порог задаёт руководитель, администратор или директор" };
  }
  if (
    !shortSeconds ||
    !longSeconds ||
    shortSeconds < 1 ||
    longSeconds > 7200 ||
    longSeconds <= shortSeconds
  ) {
    return { status: 400, error: "Длинный порог должен быть больше короткого" };
  }
  await pool.query(
    `UPDATE telephony_day_settings
     SET short_seconds = $1, long_seconds = $2
     WHERE id = 1`,
    [shortSeconds, longSeconds]
  );
  return { shortSeconds, longSeconds };
};

module.exports = {
  recordingsRoot,
  recordingFile,
  talkMark,
  getTalkMarks,
  canListen,
  decorateCompanyCalls,
  openRecording,
  saveTalkMarks,
};
