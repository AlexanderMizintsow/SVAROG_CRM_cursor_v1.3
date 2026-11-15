// Итог «перезвонить» и срок пропущенного. Вставленные строки удаляются.
//
//   node replay-call-followup.js

require("dotenv").config();
const { Pool } = require("pg");
const { ensureCallCardSchema } = require("../asterisk_server/callCardStore");
const { getCallDay, isMissedOverdue } = require("./callDay");
const { createCallbackReminder } = require("./callFollowup");

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

const run = async () => {
  await ensureCallCardSchema(pool);
  const now = Date.now();
  assert(isMissedOverdue(new Date(now - 20 * 60000), 15, now), "20 минут при сроке 15 не просрочены");
  assert(!isMissedOverdue(new Date(now - 5 * 60000), 15, now), "5 минут уже считаются просроченными");

  const sample = await pool.query(`
    SELECT c.id AS company_id, c.regional_manager_id AS user_id, phone_key(p.phone_number) AS phone
    FROM companies c
    JOIN phone_numbers_companies p ON p.company_id = c.id
    WHERE c.regional_manager_id IS NOT NULL
      AND length(phone_key(p.phone_number)) > 5
    ORDER BY c.id
    LIMIT 1
  `);
  assert(sample.rows.length, "нет компании с менеджером и телефоном");
  const { company_id: companyId, user_id: userId, phone } = sample.rows[0];

  const missed = await pool.query(
    `INSERT INTO calls (caller_number, receiver_number, accepted_at, status, direction)
     VALUES ($1, '108', NOW() - INTERVAL '2 hours', 'missed', 'incoming')
     RETURNING id`,
    [phone]
  );
  const missedId = missed.rows[0].id;
  let outgoingId = null;
  let reminderId = null;
  try {
    const open = await getCallDay(pool, userId);
    assert(
      open.missed.some((row) => row.companyId === companyId),
      "свежий пропущенный не попал менеджеру"
    );
    assert(open.missedMinutes === 15, "срок по умолчанию не 15 минут");

    outgoingId = (
      await pool.query(
        `INSERT INTO calls (caller_number, receiver_number, accepted_at, status, direction, talk_seconds)
         VALUES ('108', $1, NOW(), 'accepted', 'outgoing', 30)
         RETURNING id`,
        [phone]
      )
    ).rows[0].id;
    const closed = await getCallDay(pool, userId);
    assert(
      !closed.missed.some((row) => row.callId === missedId),
      "следующий разговор не закрыл пропущенный"
    );

    const callbackCall = await pool.query(
      `INSERT INTO calls (caller_number, receiver_number, accepted_at, status, direction)
       VALUES ($1, '108', NOW(), 'accepted', 'incoming')
       RETURNING id`,
      [phone]
    );
    const created = await createCallbackReminder(pool, {
      callId: callbackCall.rows[0].id,
      userId,
      callbackAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      description: "проверка перезвона",
    });
    assert(!created.error, created.error || "напоминание не создано");
    assert(created.companyId === companyId, "напоминание не на эту компанию");
    reminderId = created.reminderId;
    const stored = await pool.query(
      "SELECT user_id, company_id, type_reminders FROM reminders WHERE id = $1",
      [reminderId]
    );
    assert(stored.rows[0].user_id === userId, "напоминание не на менеджера");
    assert(stored.rows[0].company_id === companyId, "в напоминании нет компании");
    assert(stored.rows[0].type_reminders === "call", "тип напоминания не звонок");

    const withReminder = await getCallDay(pool, userId);
    assert(
      withReminder.reminders.some((row) => row.reminderId === reminderId && row.companyId === companyId),
      "напоминание не видно в списке дел"
    );

    await pool.query("DELETE FROM calls WHERE id = $1", [callbackCall.rows[0].id]);
  } finally {
    if (reminderId) await pool.query("DELETE FROM reminders WHERE id = $1", [reminderId]);
    await pool.query("DELETE FROM calls WHERE id = ANY($1::int[])", [
      [missedId, outgoingId].filter(Boolean),
    ]);
  }

  const forbidden = await fetch("http://127.0.0.1:5004/api/telephony-day-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, missedMinutes: 10 }),
  });
  const day = await fetch(`http://127.0.0.1:5004/api/call-day/${userId}`).then((response) =>
    response.json()
  );
  if (day.canEditMissedMinutes) {
    assert(forbidden.status === 200, "руководитель не смог сохранить срок");
    await fetch("http://127.0.0.1:5004/api/telephony-day-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, missedMinutes: 15 }),
    });
  } else {
    assert(forbidden.status === 403, "срок изменил не руководитель");
  }

  console.log(
    `Перезвон и срок проверены на компании ${companyId}, менеджер ${userId}. Вставленные звонки удалены.`
  );
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
