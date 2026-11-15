// Проверка набора без живой АТС.
// Кадр уходит только после входа и только на добавочный менеджера,
// затем станция сама соединяет с номером дилера.
//
//   node replay-originate.js

require("dotenv").config({ path: require("path").join(__dirname, "../CRM-server/.env") });
const { EventEmitter } = require("events");
const { Pool } = require("pg");
const { createAmiConnection } = require("./amiConnection");
const { buildOriginate, stationNumber } = require("./originateCall");
const { prepareOriginate } = require("../CRM-server/callOriginate");

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

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const checkFrame = async () => {
  const socket = new FakeSocket();
  const connection = createAmiConnection({
    host: "127.0.0.1",
    port: 1,
    username: "ats",
    secret: "secret",
    socketFactory: () => socket,
    onEvent() {},
    silent: true,
  });

  connection.start();

  let blocked = false;
  try {
    await connection.sendAction("Action: Originate\r\n\r\n", "crm-early", 200);
  } catch (error) {
    blocked = error.code === "ami_offline";
  }
  assert(blocked, "набор ушёл до входа в АТС");
  assert(
    !socket.writes.some((item) => item.includes("Action: Originate")),
    "кадр набора записан до входа"
  );

  socket.emit(
    "data",
    "Response: Success\r\nMessage: Authentication accepted\r\n\r\n"
  );

  const built = buildOriginate({
    extension: "108",
    stationNumber: stationNumber("+79106570779"),
    actionId: "crm-replay-1",
  });
  assert(built.stationNumber === "89106570779", "номер для станции собран неверно");
  assert(built.frame.includes("Channel: SIP/108\r\n"), "нет канала менеджера");
  assert(built.frame.includes("Context: from-internal-crm\r\n"), "не тот контекст");
  assert(built.frame.includes("Exten: 89106570779\r\n"), "нет номера дилера");
  assert(!built.frame.includes("Redirect"), "в кадре не должно быть перевода");

  let injected = false;
  try {
    buildOriginate({
      extension: "108",
      stationNumber: "89106570779\r\nAction: Redirect",
      actionId: "crm-bad",
    });
  } catch (error) {
    injected = error.code === "bad_number";
  }
  assert(injected, "чужая команда AMI прошла в номер");

  const pending = connection.sendAction(built.frame, built.actionId, 1000);
  socket.emit(
    "data",
    "Response: Success\r\nActionID: crm-replay-1\r\nMessage: Originate successfully queued\r\n\r\n"
  );
  const response = await pending;
  assert(response.Response === "Success", "АТС не подтвердила очередь набора");
  const originateWrites = socket.writes.filter((item) =>
    item.includes("Action: Originate")
  );
  assert(originateWrites.length === 1, "кадр набора ушёл не один раз");
  connection.stop();
};

const checkDatabase = async () => {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: String(process.env.DB_NAME || "").split(" ")[0],
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });
  try {
    const ready = await prepareOriginate(pool, {
      userId: 2,
      companyId: 63,
      phone: "+79106570779",
    });
    assert(!ready.error, ready.error || "подготовка набора не удалась");
    assert(ready.extension === "108", `ожидался добавочный 108, пришёл ${ready.extension}`);
    assert(ready.stationNumber === "89106570779", "номер компании собран неверно");

    const desk = await prepareOriginate(pool, {
      userId: 4,
      companyId: 63,
      phone: "+79106570779",
    });
    assert(desk.extension === "103", `стационарный 103 не выбран, пришёл ${desk.extension}`);

    const foreign = await prepareOriginate(pool, {
      userId: 2,
      companyId: 63,
      phone: "+79000000000",
    });
    assert(foreign.status === 400, "чужой номер не отклонён");

    const noExt = await pool.query(`
      SELECT u.id
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM user_phones up
        WHERE up.user_id = u.id
          AND length(regexp_replace(up.phone_number, '\\D', '', 'g')) BETWEEN 2 AND 5
          AND (
            lower(up.phone_type) LIKE '%рабоч%'
            OR lower(up.phone_type) LIKE '%стационар%'
          )
      )
      ORDER BY u.id
      LIMIT 1
    `);
    if (noExt.rows.length) {
      const missing = await prepareOriginate(pool, {
        userId: noExt.rows[0].id,
        companyId: 63,
        phone: "+79106570779",
      });
      assert(missing.status === 409, "набор без добавочного не остановлен");
    }
  } finally {
    await pool.end();
  }
};

const run = async () => {
  await checkFrame();
  await checkDatabase();
  console.log("Набор проверен: сначала добавочный, затем номер дилера. В АТС кадр не уходил.");
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
