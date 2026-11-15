// Окно звонка без живой АТС.
// Проверяет карточку номера и что исходящий тоже собирается для окна.
//
//   node replay-call-window.js

require("dotenv").config({ path: require("path").join(__dirname, "../CRM-server/.env") });
const { Pool } = require("pg");
const { createCallTracker } = require("./callCard");
const { getCallParty } = require("./callParty");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const track = (events) => {
  const cards = [];
  const tracker = createCallTracker({
    onProgress(card) {
      cards.push(card);
    },
  });
  events.forEach((event) => tracker.feed(event));
  return cards[cards.length - 1];
};

const checkCards = () => {
  const outgoing = track([
    {
      Event: "Newchannel",
      Channel: "SIP/103-000000c7",
      CallerIDNum: "103",
      Exten: "89064058645",
      Context: "from-internal-crm",
      Uniqueid: "1793691610.277",
    },
    {
      Event: "VarSet",
      Variable: "__DIRECTCRM",
      Value: "outgoing",
      Uniqueid: "1793691610.277",
    },
    {
      Event: "VarSet",
      Variable: "__PERVIYNUMBER",
      Value: "89064058645",
      Uniqueid: "1793691610.277",
    },
  ]);
  assert(outgoing.direction === "outgoing", "исходящий не собран");
  assert(outgoing.extension === "103", "у исходящего нет добавочного менеджера");
  assert(outgoing.receiverNumber === "79064058645", "у исходящего нет номера дилера");

  const incoming = track([
    {
      Event: "Newchannel",
      Channel: "SIP/beeline-0000004f",
      CallerIDNum: "89374440569",
      Uniqueid: "1793686314.97",
    },
    {
      Event: "VarSet",
      Variable: "__DIRECTCRM",
      Value: "incoming",
      Uniqueid: "1793686314.97",
    },
    {
      Event: "Dial",
      SubEvent: "Begin",
      UniqueID: "1793686314.97",
      DestUniqueID: "1793686325.98",
      Dialstring: "108@from-internal",
    },
  ]);
  assert(incoming.direction === "incoming", "входящий не собран");
  assert(incoming.callerNumber === "79374440569", "у входящего нет номера дилера");
  assert(incoming.extension === "108", "у входящего нет добавочного");
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
    const known = await getCallParty(pool, "+79106570779");
    assert(known.known, "известный номер не найден");
    assert(known.companyId === 63, `ожидалась компания 63, пришла ${known.companyId}`);
    assert(known.companyName, "нет названия компании");

    const unknown = await getCallParty(pool, "+79000000000");
    assert(!unknown.known, "чужой номер определился как компания");
    assert(!unknown.companyId, "у чужого номера появилась компания");

    const extension = await getCallParty(pool, "108");
    assert(!extension.known, "добавочный попал в окно как дилер");
  } finally {
    await pool.end();
  }
};

const checkApi = async () => {
  const response = await fetch(
    "http://127.0.0.1:5004/api/call-party?phone=" + encodeURIComponent("+79106570779")
  );
  const body = await response.json();
  assert(response.status === 200, "API карточки номера не ответил");
  assert(body.companyId === 63, "API отдал не ту компанию");
  const missing = await fetch("http://127.0.0.1:5004/api/call-party");
  assert(missing.status === 400, "пустой номер не отклонён");
};

const run = async () => {
  checkCards();
  await checkDatabase();
  await checkApi();
  console.log("Окно звонка: компания находится, чужой номер пустой, исходящий собран. В АТС ничего не уходило.");
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
