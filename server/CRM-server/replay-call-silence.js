// Срок «пора позвонить»: отдел, свой срок менеджера, обе стороны звонка.
// Вставленные звонки и изменённые сроки возвращаются как были.
//
//   node replay-call-silence.js

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { Pool } = require("pg");
const { ensureCallCardSchema } = require("../asterisk_server/callCardStore");
const { getCallDay, resolveSilenceDays, collectLists } = require("./callDay");

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

const companyRow = [{ id: 1, name_companies: "Проверка", manager_name: "Менеджер" }];
const phoneRow = [{ company_id: 1, phone: "79000000001" }];

const call = (id, daysAgo, direction, status = "accepted") => ({
  company_id: 1,
  company_name: "Проверка",
  call_id: id,
  accepted_at: new Date(Date.now() - daysAgo * 86400000),
  status,
  talk_seconds: status === "missed" ? 0 : 20,
  call_direction: direction,
  external_number: "79000000001",
});

const listed = (rows, minutes = 15) =>
  collectLists(companyRow, rows, phoneRow, minutes).silence;

const run = async () => {
  const incomingOnly = listed([call(1, 20, "incoming")]);
  assert(incomingOnly.length === 1, "старый входящий не оставил компанию в молчании");
  assert(incomingOnly[0].lastDirection === "incoming", "направление последнего входящего потеряно");
  assert(incomingOnly[0].daysSilent >= 19, "дни молчания по входящему не посчитаны");

  const afterOutgoing = listed([
    call(1, 20, "incoming"),
    call(2, 0, "outgoing"),
  ]);
  assert(afterOutgoing[0].daysSilent === 0, "свежий исходящий не сбросил молчание");
  assert(afterOutgoing[0].lastDirection === "outgoing", "последним не стал исходящий");

  const afterIncoming = listed([
    call(1, 20, "outgoing"),
    call(2, 0, "incoming"),
  ]);
  assert(afterIncoming[0].lastDirection === "incoming", "свежий входящий не стал последним");
  assert(afterIncoming[0].daysSilent === 0, "свежий входящий не сбросил молчание");

  const missed = collectLists(
    companyRow,
    [call(1, 2, "incoming", "missed")],
    phoneRow,
    15
  );
  assert(missed.silence.length === 0, "открытый пропущенный попал в «пора позвонить»");
  assert(missed.missed.length === 1, "открытый пропущенный пропал из пропущенных");

  assert(resolveSilenceDays({ ownDays: 9, departmentDays: 11, defaultDays: 14 }).source === "user", "свой срок не важнее отдела");
  assert(resolveSilenceDays({ ownDays: null, departmentDays: 11, defaultDays: 14 }).days === 11, "срок отдела не подхватился");
  assert(resolveSilenceDays({ ownDays: null, departmentDays: null, defaultDays: 14 }).source === "default", "общий срок не остался запасным");

  await ensureCallCardSchema(pool);

  const sample = await pool.query(`
    SELECT c.id AS company_id,
           c.regional_manager_id AS user_id,
           u.department_id,
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

  const previousUser = await pool.query(
    "SELECT silence_days FROM calls_settings_users WHERE user_id = $1",
    [userId]
  );
  const hadUserRow = previousUser.rows.length > 0;
  const previousOwn = hadUserRow ? previousUser.rows[0].silence_days : null;
  const previousDepartment = departmentId
    ? (
        await pool.query("SELECT silence_days FROM departments WHERE id = $1", [departmentId])
      ).rows[0].silence_days
    : null;
  const previousDefault = (
    await pool.query("SELECT silence_days FROM telephony_day_settings WHERE id = 1")
  ).rows[0].silence_days;

  const setOwn = async (days) => {
    await pool.query(
      `INSERT INTO calls_settings_users (user_id, silence_days)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET silence_days = EXCLUDED.silence_days`,
      [userId, days]
    );
  };

  const inserted = [];
  try {
    await setOwn(21);
    const personal = await getCallDay(pool, userId);
    assert(personal.silenceDays === 21 && personal.silenceSource === "user", "свой срок менеджера не применился");
    const ownedIds = new Set(
      (
        await pool.query(
          `SELECT id FROM companies
           WHERE regional_manager_id = $1 OR mpp_id = $1 OR mpr_id = $1
              OR id IN (SELECT company_id FROM replacing_mpr WHERE user_id = $1)
              OR id IN (SELECT company_id FROM replacing_mpp WHERE user_id = $1)`,
          [userId]
        )
      ).rows.map((row) => row.id)
    );
    personal.silence.forEach((row) => {
      assert(ownedIds.has(row.companyId), "в «пора позвонить» попала чужая компания");
    });

    await setOwn(null);
    if (departmentId) {
      await pool.query("UPDATE departments SET silence_days = 17 WHERE id = $1", [departmentId]);
      const department = await getCallDay(pool, userId);
      assert(
        department.silenceDays === 17 && department.silenceSource === "department",
        "срок отдела не применился после сброса своего"
      );
      await pool.query("UPDATE departments SET silence_days = NULL WHERE id = $1", [departmentId]);
    }

    await pool.query("UPDATE telephony_day_settings SET silence_days = 13 WHERE id = 1");
    const general = await getCallDay(pool, userId);
    assert(
      general.silenceDays === 13 && general.silenceSource === "default",
      "общий срок не применился"
    );

    await setOwn(10000);
    const wide = await getCallDay(pool, userId);
    wide.silence.forEach((row) => {
      assert(row.daysSilent === null, "компания со звонком осталась при сроке 10000 дней");
    });

    const outgoing = await pool.query(
      `INSERT INTO calls (caller_number, receiver_number, accepted_at, status, direction, talk_seconds)
       VALUES ('108', $1, $2, 'accepted', 'outgoing', 12)
       RETURNING id`,
      [phone, new Date()]
    );
    inserted.push(outgoing.rows[0].id);
    await setOwn(1);
    const afterOut = await getCallDay(pool, userId);
    assert(
      !afterOut.silence.some((row) => row.companyId === companyId),
      "свежий исходящий не убрал компанию из «пора позвонить»"
    );

    await pool.query("DELETE FROM calls WHERE id = $1", [outgoing.rows[0].id]);
    inserted.pop();
    const incoming = await pool.query(
      `INSERT INTO calls (caller_number, receiver_number, accepted_at, status, direction, talk_seconds)
       VALUES ($1, '108', $2, 'accepted', 'incoming', 12)
       RETURNING id`,
      [phone, new Date()]
    );
    inserted.push(incoming.rows[0].id);
    const afterIn = await getCallDay(pool, userId);
    assert(
      !afterIn.silence.some((row) => row.companyId === companyId),
      "свежий входящий не убрал компанию из «пора позвонить»"
    );

    const stranger = await pool.query(
      `SELECT u.id
       FROM users u
       WHERE u.id <> $1
         AND NOT EXISTS (
           SELECT 1 FROM companies c
           WHERE c.id = $2
             AND (
               c.regional_manager_id = u.id OR c.mpp_id = u.id OR c.mpr_id = u.id
               OR EXISTS (SELECT 1 FROM replacing_mpr r WHERE r.company_id = c.id AND r.user_id = u.id)
               OR EXISTS (SELECT 1 FROM replacing_mpp r WHERE r.company_id = c.id AND r.user_id = u.id)
             )
         )
       ORDER BY u.id
       LIMIT 1`,
      [userId, companyId]
    );
    if (stranger.rows.length) {
      const foreign = await getCallDay(pool, stranger.rows[0].id);
      assert(
        !foreign.silence.some((row) => row.companyId === companyId) &&
          !foreign.missed.some((row) => row.companyId === companyId),
        "чужой менеджер увидел компанию"
      );
    }

    console.log(
      `Пора позвонить проверено на компании ${companyId}, менеджер ${userId}. Сроки и звонки возвращены.`
    );
  } finally {
    if (inserted.length) {
      await pool.query("DELETE FROM calls WHERE id = ANY($1::int[])", [inserted]);
    }
    if (hadUserRow) {
      await pool.query(
        "UPDATE calls_settings_users SET silence_days = $2 WHERE user_id = $1",
        [userId, previousOwn]
      );
    } else {
      await pool.query("DELETE FROM calls_settings_users WHERE user_id = $1", [userId]);
    }
    if (departmentId) {
      await pool.query("UPDATE departments SET silence_days = $2 WHERE id = $1", [
        departmentId,
        previousDepartment,
      ]);
    }
    await pool.query("UPDATE telephony_day_settings SET silence_days = $1 WHERE id = 1", [
      previousDefault,
    ]);
  }
};

run()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error.message);
    await pool.end();
    process.exit(1);
  });
