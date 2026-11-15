// Рабочие часы: окно напоминаний и перенос времени за его пределы.
// Вставленные звонки и изменённые часы возвращаются.
//
//   node replay-call-hours.js

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { Pool } = require("pg");
const { ensureCallCardSchema } = require("../asterisk_server/callCardStore");
const { getCallDay } = require("./callDay");
const { createCallbackReminder } = require("./callFollowup");
const {
  isInsideWindow,
  clampToWindow,
  reminderVisible,
  getWorkHours,
  filterDueReminders,
  planSilenceReminders,
} = require("./workHours");

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

const atHour = (hours, minutes = 0) => {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const run = async () => {
  const morning = atHour(9, 0);
  const midday = atHour(12, 0);
  const closing = atHour(18, 0);
  const early = atHour(8, 30);
  const night = atHour(22, 0);

  assert(isInsideWindow(morning, "09:00", "18:00"), "09:00 уже вне окна");
  assert(isInsideWindow(midday, "09:00", "18:00"), "полдень вне окна");
  assert(!isInsideWindow(closing, "09:00", "18:00"), "18:00 ещё считается рабочим");
  assert(!isInsideWindow(early, "09:00", "18:00"), "08:30 попало в окно");
  assert(!isInsideWindow(night, "09:00", "18:00"), "22:00 попало в окно");

  const kept = clampToWindow(midday, "09:00", "18:00");
  assert(!kept.adjusted && kept.date.getTime() === midday.getTime(), "дневное время сдвинуто");
  const before = clampToWindow(early, "09:00", "18:00");
  assert(before.adjusted && before.date.getHours() === 9 && before.date.getDate() === early.getDate(), "утро не перенесено на начало окна");
  const after = clampToWindow(night, "09:00", "18:00");
  assert(after.adjusted && after.date.getHours() === 9, "ночь не перенесена на 09:00");
  assert(after.date.getDate() !== night.getDate(), "ночь осталась в том же дне");
  assert(isInsideWindow(after.date, "09:00", "18:00"), "перенесённое время вне окна");

  assert(reminderVisible({ type_reminders: "task" }, { start: "09:00", end: "18:00" }, night), "задача пропала ночью");
  assert(!reminderVisible({ type_reminders: "call" }, { start: "09:00", end: "18:00" }, night), "звонок пришёл ночью");
  assert(reminderVisible({ type_reminders: "call" }, { start: "09:00", end: "18:00" }, midday), "звонок скрыт днём");

  await ensureCallCardSchema(pool);
  const sample = await pool.query(`
    SELECT c.id AS company_id, c.regional_manager_id AS user_id, u.department_id,
           phone_key(p.phone_number) AS phone
    FROM companies c
    JOIN users u ON u.id = c.regional_manager_id
    JOIN phone_numbers_companies p ON p.company_id = c.id
    WHERE length(phone_key(p.phone_number)) > 5
    ORDER BY c.id
    LIMIT 1
  `);
  assert(sample.rows.length, "нет компании с менеджером и телефоном");
  const { company_id: companyId, user_id: userId, department_id: departmentId, phone } =
    sample.rows[0];

  const previousDepartment = departmentId
    ? (
        await pool.query(
          "SELECT to_char(work_start, 'HH24:MI') AS work_start, to_char(work_end, 'HH24:MI') AS work_end FROM departments WHERE id = $1",
          [departmentId]
        )
      ).rows[0]
    : null;
  const previousDefault = (
    await pool.query(
      "SELECT to_char(work_start, 'HH24:MI') AS work_start, to_char(work_end, 'HH24:MI') AS work_end FROM telephony_day_settings WHERE id = 1"
    )
  ).rows[0];

  let callId = null;
  let reminderId = null;
  try {
    const open = await getWorkHours(pool, userId);
    assert(open.start === "09:00" && open.end === "18:00", "окно по умолчанию не 09:00–18:00");

    const call = await pool.query(
      `INSERT INTO calls (caller_number, receiver_number, accepted_at, status, direction, talk_seconds)
       VALUES ($1, '108', $2, 'accepted', 'incoming', 20)
       RETURNING id`,
      [phone, new Date()]
    );
    callId = call.rows[0].id;
    const created = await createCallbackReminder(pool, {
      callId,
      userId,
      callbackAt: night.toISOString(),
      description: "проверка рабочих часов",
    });
    assert(!created.error, created.error || "напоминание не создано");
    assert(created.adjusted, "ночное время не перенесено");
    reminderId = created.reminderId;
    const stored = await pool.query("SELECT date_time FROM reminders WHERE id = $1", [reminderId]);
    const storedAt = new Date(stored.rows[0].date_time);
    assert(storedAt.getHours() === 9, "в базе ночное напоминание не на 09:00");
    assert(isInsideWindow(storedAt, "09:00", "18:00"), "сохранённое время вне окна");
    await pool.query("DELETE FROM reminders WHERE id = $1", [reminderId]);
    reminderId = null;
    await pool.query("DELETE FROM calls WHERE id = $1", [callId]);
    callId = null;

    const hidden = await filterDueReminders(
      pool,
      [
        { type_reminders: "call", user_id: userId },
        { type_reminders: "task", user_id: userId },
      ],
      night
    );
    assert(hidden.length === 1 && hidden[0].type_reminders === "task", "ночью разослан звонок или пропала задача");
    const shown = await filterDueReminders(
      pool,
      [
        { type_reminders: "call", user_id: userId },
        { type_reminders: "task", user_id: userId },
      ],
      midday
    );
    assert(shown.length === 2, "днём звонок не попал в рассылку");

    const planned = await planSilenceReminders(pool, { now: night, userId });
    planned.forEach((row) => {
      assert(row.when.getHours() === 9, "план «пора позвонить» стоит не на начало окна");
      assert(isInsideWindow(row.when, row.start, row.end), "план вне окна менеджера");
    });

    if (departmentId) {
      await pool.query(
        "UPDATE departments SET work_start = '10:00', work_end = '16:00' WHERE id = $1",
        [departmentId]
      );
      const departmentDay = await getCallDay(pool, userId);
      assert(
        departmentDay.workStart === "10:00" &&
          departmentDay.workEnd === "16:00" &&
          departmentDay.workSource === "department",
        "окно отдела не применилось"
      );
      await pool.query(
        "UPDATE departments SET work_start = NULL, work_end = NULL WHERE id = $1",
        [departmentId]
      );
    }

    await pool.query(
      "UPDATE telephony_day_settings SET work_start = '08:00', work_end = '17:00' WHERE id = 1"
    );
    const general = await getWorkHours(pool, userId);
    assert(general.start === "08:00" && general.source === "default", "общее окно не применилось");

    console.log(
      `Рабочие часы проверены на компании ${companyId}, менеджер ${userId}. План компаний: ${planned.length}. Часы возвращены.`
    );
  } finally {
    if (reminderId) await pool.query("DELETE FROM reminders WHERE id = $1", [reminderId]);
    if (callId) await pool.query("DELETE FROM calls WHERE id = $1", [callId]);
    if (departmentId) {
      await pool.query(
        "UPDATE departments SET work_start = $2::time, work_end = $3::time WHERE id = $1",
        [departmentId, previousDepartment.work_start, previousDepartment.work_end]
      );
    }
    await pool.query(
      "UPDATE telephony_day_settings SET work_start = $1::time, work_end = $2::time WHERE id = 1",
      [previousDefault.work_start || "09:00", previousDefault.work_end || "18:00"]
    );
  }
};

run()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error.message);
    await pool.end();
    process.exit(1);
  });
