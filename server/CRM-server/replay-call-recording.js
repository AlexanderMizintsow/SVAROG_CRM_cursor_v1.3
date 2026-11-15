// Прослушивание: файл виден только из папки записей, чужую запись не отдают.
// Порог короткого и длинного возвращается. Вставленные звонки удаляются.
//
//   node replay-call-recording.js

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { Pool } = require("pg");
const { ensureCallCardSchema } = require("../asterisk_server/callCardStore");
const { getCallDay } = require("./callDay");
const {
  recordingFile,
  talkMark,
  openRecording,
  saveTalkMarks,
  getTalkMarks,
  decorateCompanyCalls,
} = require("./callRecording");

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

const wavSilence = () => {
  const data = Buffer.alloc(8000, 128);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(8000, 24);
  header.writeUInt32LE(8000, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
};

const run = async () => {
  await ensureCallCardSchema(pool);
  const before = await getTalkMarks(pool);
  const folder = path.join(__dirname, "call-recordings");
  fs.mkdirSync(folder, { recursive: true });
  const fileName = "replay-short-talk.wav";
  fs.writeFileSync(path.join(folder, fileName), wavSilence());

  assert(talkMark(20, 30, 180) === "short", "короткий не отмечен");
  assert(talkMark(200, 30, 180) === "long", "длинный не отмечен");
  assert(talkMark(60, 30, 180) === null, "средний получил отметку");
  assert(recordingFile(`/var/spool/asterisk/monitor/${fileName}`), "файл из папки не найден");
  assert(!recordingFile("/var/spool/asterisk/monitor/../.env"), "чужой путь открылся");

  const owner = await pool.query(
    `SELECT u.id, u.department_id
     FROM user_phones up
     JOIN users u ON u.id = up.user_id
     WHERE up.phone_number = '108'
     ORDER BY CASE WHEN up.phone_type ILIKE '%стационар%' THEN 0 ELSE 1 END, u.id
     LIMIT 1`
  );
  assert(owner.rows[0], "добавочный 108 не найден");
  const managerId = owner.rows[0].id;

  const inserted = await pool.query(
    `INSERT INTO calls (
       caller_number, receiver_number, accepted_at, status, direction,
       talk_seconds, extension, recording_path
     )
     VALUES
       ('108', '79626293325', $1, 'accepted', 'outgoing', 20, '108', $2),
       ('108', '79626293325', $1, 'accepted', 'outgoing', 200, '108', $2)
     RETURNING id, talk_seconds`,
    [new Date(), `/var/spool/asterisk/monitor/${fileName}`]
  );
  const shortCall = inserted.rows.find((row) => row.talk_seconds === 20);
  const longCall = inserted.rows.find((row) => row.talk_seconds === 200);
  const ids = inserted.rows.map((row) => row.id);

  try {
    const denied = await openRecording(pool, 14, shortCall.id);
    assert(denied.status === 403, "администратор без галочки услышал запись");

    const own = await openRecording(pool, managerId, shortCall.id);
    assert(own.file, "автор не услышал свою запись");

    const played = await pool.query(
      `SELECT COUNT(*)::int AS count FROM call_recording_plays
       WHERE call_id = $1 AND user_id = $2`,
      [shortCall.id, managerId]
    );
    assert(played.rows[0].count >= 1, "прослушивание не записано");

    const rows = [
      {
        talk_seconds: 20,
        recording_path: `/var/spool/asterisk/monitor/${fileName}`,
        manager_user_id: managerId,
        manager_department_id: owner.rows[0].department_id,
      },
      {
        talk_seconds: 200,
        recording_path: `/var/spool/asterisk/monitor/${fileName}`,
        manager_user_id: managerId,
        manager_department_id: owner.rows[0].department_id,
      },
    ];
    await decorateCompanyCalls(pool, managerId, rows);
    assert(rows[0].talk_mark === "short" && rows[0].can_play, "короткая запись не открылась автору");
    assert(rows[1].talk_mark === "long" && rows[1].can_play, "длинная запись не открылась автору");
    assert(!rows[0].recording_path, "путь к файлу ушёл в ответ");

    const saved = await saveTalkMarks(pool, 14, 15, 120);
    assert(saved.shortSeconds === 15 && saved.longSeconds === 120, "порог не сохранился");
    const day = await getCallDay(pool, 14);
    assert(day.shortSeconds === 15 && day.longSeconds === 120, "список дел не видит порог");
    const rejected = await saveTalkMarks(pool, 14, 200, 30);
    assert(rejected.status === 400, "перевёрнутый порог принят");

    console.log(
      `Запись проверена: автор ${managerId}, звонки ${shortCall.id} и ${longCall.id}.`
    );
  } finally {
    await pool.query(`DELETE FROM call_recording_plays WHERE call_id = ANY($1::int[])`, [ids]);
    await pool.query(`DELETE FROM calls WHERE id = ANY($1::int[])`, [ids]);
    await saveTalkMarks(pool, 14, before.shortSeconds, before.longSeconds);
    fs.rmSync(path.join(folder, fileName), { force: true });
    if (fs.existsSync(folder) && fs.readdirSync(folder).length === 0) fs.rmdirSync(folder);
  }
};

run()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
