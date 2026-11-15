// Занятость линии: 0 свободен, 8 звонит, 1 говорит. Чужой контекст не берётся.
//
//   node replay-line-status.js

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { Pool } = require("pg");
const { readExtensionStatus } = require("../asterisk_server/extensionStatus");
const { applyExtensionEvent, snapshot, resetLines } = require("./lineBoard");

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

const event = (status, context = "ext-local", exten = "108") => ({
  Event: "ExtensionStatus",
  Exten: exten,
  Context: context,
  Status: String(status),
});

const stateOf = (rows, userId) => {
  const row = rows.find((item) => item.userId === userId);
  return row ? row.state : null;
};

const run = async () => {
  resetLines();
  assert(readExtensionStatus(event(0)).state === "free", "0 не свободен");
  assert(readExtensionStatus(event(8)).state === "ringing", "8 не звонит");
  assert(readExtensionStatus(event(1)).state === "talking", "1 не говорит");
  assert(
    readExtensionStatus(event(1, "from-trunk-b")) === null,
    "чужой контекст попал в линию"
  );

  const owner = await pool.query(
    `SELECT user_id FROM user_phones
     WHERE phone_number = '108'
       AND (phone_type ILIKE '%рабоч%' OR phone_type ILIKE '%стационар%')
     ORDER BY user_id
     LIMIT 1`
  );
  assert(owner.rows[0], "рабочий 108 не найден");
  const userId = owner.rows[0].user_id;

  await applyExtensionEvent(pool, event(8));
  assert(stateOf(await snapshot(pool), userId) === "ringing", "сотрудник не звонит");
  await applyExtensionEvent(pool, event(1));
  assert(stateOf(await snapshot(pool), userId) === "talking", "сотрудник не говорит");
  await applyExtensionEvent(pool, event(0));
  assert(stateOf(await snapshot(pool), userId) === "free", "сотрудник не свободен");
  await applyExtensionEvent(pool, event(4));
  assert(stateOf(await snapshot(pool), userId) === null, "недоступная линия осталась");

  resetLines();
  console.log(`Линия проверена на добавочном 108, сотрудник ${userId}.`);
};

run()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
