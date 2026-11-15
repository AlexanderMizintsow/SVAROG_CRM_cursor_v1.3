// Рабочие часы напоминаний о звонках.
// Вне окна напоминание не приходит: время переносится на начало следующего окна.
// Раз в день компании без разговора дольше срока получают напоминание внутри окна.

const { ensureCallCardSchema } = require("../asterisk_server/callCardStore");

const DEFAULT_START = "09:00";
const DEFAULT_END = "18:00";

const clockMinutes = (value) => {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const formatClock = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
};

const normalizeClock = (value) => {
  const minutes = clockMinutes(value);
  if (minutes == null) return null;
  return formatClock(minutes);
};

const resolveWorkHours = ({
  departmentStart,
  departmentEnd,
  defaultStart,
  defaultEnd,
}) => {
  const departmentFrom = clockMinutes(departmentStart);
  const departmentTo = clockMinutes(departmentEnd);
  if (departmentFrom != null && departmentTo != null && departmentTo > departmentFrom) {
    return {
      start: formatClock(departmentFrom),
      end: formatClock(departmentTo),
      source: "department",
    };
  }
  const from = clockMinutes(defaultStart);
  const to = clockMinutes(defaultEnd);
  if (from != null && to != null && to > from) {
    return { start: formatClock(from), end: formatClock(to), source: "default" };
  }
  return { start: DEFAULT_START, end: DEFAULT_END, source: "default" };
};

const minutesOfDay = (date) => date.getHours() * 60 + date.getMinutes();

const isInsideWindow = (date, start, end) => {
  const from = clockMinutes(start);
  const to = clockMinutes(end);
  if (from == null || to == null || to <= from) return true;
  const current = minutesOfDay(date);
  return current >= from && current < to;
};

const atClock = (day, minutes) => {
  const next = new Date(day);
  next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return next;
};

const clampToWindow = (date, start, end) => {
  const source = new Date(date);
  if (Number.isNaN(source.getTime())) return null;
  const from = clockMinutes(start);
  const to = clockMinutes(end);
  if (from == null || to == null || to <= from) {
    return { date: source, adjusted: false };
  }
  const current = minutesOfDay(source);
  if (current >= from && current < to) {
    return { date: source, adjusted: false };
  }
  if (current < from) {
    return { date: atClock(source, from), adjusted: true };
  }
  const tomorrow = new Date(source);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { date: atClock(tomorrow, from), adjusted: true };
};

const localDateKey = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const reminderVisible = (row, hours, now) => {
  if (!row || row.type_reminders !== "call") return true;
  if (!hours) return true;
  return isInsideWindow(now, hours.start, hours.end);
};

const getWorkHours = async (pool, userId) => {
  const result = await pool.query(
    `SELECT to_char(s.work_start, 'HH24:MI') AS default_start,
            to_char(s.work_end, 'HH24:MI') AS default_end,
            to_char(d.work_start, 'HH24:MI') AS department_start,
            to_char(d.work_end, 'HH24:MI') AS department_end
     FROM telephony_day_settings s
     LEFT JOIN users u ON u.id = $1
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE s.id = 1`,
    [userId || 0]
  );
  const row = result.rows[0] || {};
  return resolveWorkHours({
    departmentStart: row.department_start,
    departmentEnd: row.department_end,
    defaultStart: row.default_start,
    defaultEnd: row.default_end,
  });
};

let hoursCache = { at: 0, rows: new Map() };

const hoursForUsers = async (pool, userIds, now) => {
  if (!userIds.length) return new Map();
  if (now - hoursCache.at < 60000 && userIds.every((id) => hoursCache.rows.has(id))) {
    return hoursCache.rows;
  }
  const result = await pool.query(
    `SELECT u.id,
            to_char(COALESCE(d.work_start, s.work_start), 'HH24:MI') AS work_start,
            to_char(COALESCE(d.work_end, s.work_end), 'HH24:MI') AS work_end
     FROM users u
     CROSS JOIN telephony_day_settings s
     LEFT JOIN departments d
       ON d.id = u.department_id
      AND d.work_start IS NOT NULL
      AND d.work_end IS NOT NULL
     WHERE s.id = 1 AND u.id = ANY($1::int[])`,
    [userIds]
  );
  const map = new Map();
  result.rows.forEach((row) => {
    map.set(
      row.id,
      resolveWorkHours({ defaultStart: row.work_start, defaultEnd: row.work_end })
    );
  });
  hoursCache = { at: now, rows: map };
  return map;
};

const filterDueReminders = async (pool, rows, now = new Date()) => {
  if (!rows || !rows.length) return rows || [];
  try {
    const callUsers = [
      ...new Set(
        rows.filter((row) => row.type_reminders === "call").map((row) => row.user_id)
      ),
    ];
    if (!callUsers.length) return rows;
    const hours = await hoursForUsers(pool, callUsers, now.getTime());
    return rows.filter((row) => reminderVisible(row, hours.get(row.user_id), now));
  } catch (error) {
    console.error("Рабочие часы напоминаний:", error.message);
    return rows;
  }
};

const scheduleCallTime = async (pool, userId, date) => {
  const hours = await getWorkHours(pool, userId);
  const clamped = clampToWindow(date, hours.start, hours.end);
  return { ...(clamped || { date, adjusted: false }), ...hours };
};

const managerIdsSql = `
  SELECT DISTINCT user_id FROM (
    SELECT regional_manager_id AS user_id FROM companies
    UNION ALL SELECT mpp_id FROM companies
    UNION ALL SELECT mpr_id FROM companies
    UNION ALL SELECT user_id FROM replacing_mpr
    UNION ALL SELECT user_id FROM replacing_mpp
  ) people
  WHERE user_id IS NOT NULL
`;

const planSilenceReminders = async (pool, { now = new Date(), userId }) => {
  const { getCallDay } = require("./callDay");
  const day = await getCallDay(pool, userId);
  return day.silence.map((row) => ({
    userId,
    companyId: row.companyId,
    companyName: row.companyName,
    when: clampToWindow(now, day.workStart, day.workEnd).date,
    start: day.workStart,
    end: day.workEnd,
  }));
};

const createSilenceReminders = async (pool, { now = new Date(), userId = null } = {}) => {
  let userIds = [];
  if (userId) {
    userIds = [userId];
  } else {
    const managers = await pool.query(managerIdsSql);
    userIds = managers.rows.map((row) => row.user_id);
  }

  const createdIds = [];
  for (const id of userIds) {
    let planned = [];
    try {
      planned = await planSilenceReminders(pool, { now, userId: id });
    } catch (error) {
      console.error("Проверка компаний, менеджер", id, error.message);
      continue;
    }
    if (!planned.length) continue;
    const companyIds = planned.map((row) => row.companyId);
    const existing = await pool.query(
      `SELECT company_id FROM reminders
       WHERE user_id = $1
         AND type_reminders = 'call'
         AND COALESCE(is_completed, false) = false
         AND company_id = ANY($2::int[])`,
      [id, companyIds]
    );
    const taken = new Set(existing.rows.map((row) => row.company_id));
    for (const row of planned) {
      if (!row.companyId || taken.has(row.companyId)) continue;
      const inserted = await pool.query(
        `INSERT INTO reminders (
           related_id, user_id, company_id, date_time, comment,
           type_reminders, title, priority_notifications, tags, links
         )
         VALUES (0, $1, $2, $3, $4, 'call', 'Пора позвонить', 'normal', '[]'::jsonb, '[]'::jsonb)
         RETURNING id`,
        [id, row.companyId, row.when, row.companyName || "Пора позвонить"]
      );
      createdIds.push(inserted.rows[0].id);
      taken.add(row.companyId);
    }
  }
  return createdIds;
};

const runDailyCompanyCheck = async (pool, now = new Date()) => {
  await ensureCallCardSchema(pool);
  const today = localDateKey(now);
  const state = await pool.query(
    "SELECT to_char(last_company_check, 'YYYY-MM-DD') AS ran FROM telephony_day_settings WHERE id = 1"
  );
  if (state.rows[0] && state.rows[0].ran === today) {
    return { skipped: true, created: 0 };
  }
  const created = await createSilenceReminders(pool, { now });
  await pool.query(
    "UPDATE telephony_day_settings SET last_company_check = $1::date WHERE id = 1",
    [today]
  );
  return { skipped: false, created: created.length };
};

module.exports = {
  DEFAULT_START,
  DEFAULT_END,
  normalizeClock,
  resolveWorkHours,
  isInsideWindow,
  clampToWindow,
  reminderVisible,
  getWorkHours,
  filterDueReminders,
  scheduleCallTime,
  planSilenceReminders,
  createSilenceReminders,
  runDailyCompanyCheck,
};
