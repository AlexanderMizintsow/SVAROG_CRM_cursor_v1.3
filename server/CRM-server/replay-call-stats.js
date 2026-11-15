// Статистика звонков: доступ по роли и по галочке, цифры за период.
// Галочка и вставленный звонок возвращаются.
//
//   node replay-call-stats.js

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { Pool } = require("pg");
const { ensureCallCardSchema } = require("../asterisk_server/callCardStore");
const { getCallDay } = require("./callDay");
const {
  canViewCallStats,
  getCallStats,
  setCallStatsAccess,
  loadViewer,
} = require("./callStats");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: String(process.env.DB_NAME || "").split(" ")[0],
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const dayKey = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const run = async () => {
  await ensureCallCardSchema(pool);
  const today = dayKey(new Date());
  const admin = await loadViewer(pool, 14);
  assert(admin && admin.role_name === "Администратор", "пользователь 14 не администратор");
  assert(canViewCallStats({ ...admin, show_call_stats: false, position_name: "Менеджер", heads_department: false }) === false, "без галочки статистика открыта");
  assert(canViewCallStats({ position_name: "Руководитель отдела", show_call_stats: false }) === true, "руководитель не видит статистику");
  assert(canViewCallStats({ heads_department: false, show_call_stats: true, position_name: "Менеджер" }) === true, "галочка не открыла статистику");

  const previous = admin.show_call_stats;
  const stranger = await pool.query(
    `SELECT u.id
     FROM users u
     LEFT JOIN positions p ON p.id = u.position_id
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN calls_settings_users s ON s.user_id = u.id
     WHERE COALESCE(p.name, '') <> 'Руководитель отдела'
       AND COALESCE(r.name, '') NOT IN ('Администратор', 'Директор')
       AND NOT EXISTS (SELECT 1 FROM departments d WHERE d.head_user_id = u.id)
       AND COALESCE(s.show_call_stats, false) = false
       AND u.id <> 14
     ORDER BY u.id
     LIMIT 1`
  );
  assert(stranger.rows.length, "нет сотрудника без доступа");

  let callId = null;
  try {
    await setCallStatsAccess(pool, { editorId: 14, userId: 14, showCallStats: false });
    const closed = await getCallStats(pool, 14, today, today);
    assert(closed.status === 403, "администратор без галочки открыл статистику");
    const denied = await getCallStats(pool, stranger.rows[0].id, today, today);
    assert(denied.status === 403, "сотрудник без галочки открыл статистику");
    const forbiddenGrant = await setCallStatsAccess(pool, {
      editorId: stranger.rows[0].id,
      userId: stranger.rows[0].id,
      showCallStats: true,
    });
    assert(forbiddenGrant.status === 403, "сотрудник сам открыл себе статистику");

    await setCallStatsAccess(pool, { editorId: 14, userId: 14, showCallStats: true });
    const sample = await pool.query(`
      SELECT c.id AS company_id, phone_key(p.phone_number) AS phone
      FROM companies c
      JOIN phone_numbers_companies p ON p.company_id = c.id
      WHERE c.regional_manager_id IS NOT NULL
        AND length(phone_key(p.phone_number)) > 5
      ORDER BY c.id
      LIMIT 1
    `);
    const phone = sample.rows[0].phone;
    const inserted = await pool.query(
      `INSERT INTO calls (caller_number, receiver_number, accepted_at, status, direction, talk_seconds, extension)
       VALUES ('108', $1, $2, 'accepted', 'outgoing', 40, '108')
       RETURNING id`,
      [phone, new Date()]
    );
    callId = inserted.rows[0].id;

    const before = await getCallStats(pool, 14, today, today);
    await pool.query("DELETE FROM calls WHERE id = $1", [callId]);
    const without = await getCallStats(pool, 14, today, today);
    await pool.query(
      `INSERT INTO calls (id, caller_number, receiver_number, accepted_at, status, direction, talk_seconds, extension)
       VALUES ($1, '108', $2, $3, 'accepted', 'outgoing', 40, '108')`,
      [callId, phone, new Date()]
    );
    const open = await getCallStats(pool, 14, today, today);
    assert(!open.error, open.error || "статистика не собралась");
    assert(open.companyCount > 0, "в статистике нет компаний");
    assert(open.callCount === without.callCount + 1, "звонок периода не посчитан");
    assert(before.callCount === open.callCount, "повторный подсчёт разошёлся");
    assert(open.averageTalkSeconds > 0, "средняя длительность пустая");
    const day = await getCallDay(pool, 14);
    assert(day.missedMinutes === 15 && day.silenceDays, "список дел сломался");

    console.log(
      `Статистика проверена: компаний ${open.companyCount}, звонков за сегодня ${open.callCount}, молчат ${open.silentCount}, просроченных ${open.overdueCount}.`
    );
  } finally {
    if (callId) await pool.query("DELETE FROM calls WHERE id = $1", [callId]);
    await pool.query(
      `INSERT INTO calls_settings_users (user_id, show_call_stats)
       VALUES (14, $1)
       ON CONFLICT (user_id) DO UPDATE SET show_call_stats = EXCLUDED.show_call_stats`,
      [previous]
    );
  }
};

run()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error.stack || error.message);
    await pool.end();
    process.exit(1);
  });
