const fs = require("fs");
const path = require("path");
const { noteWork } = require("./workLog");

const migrationPath = path.join(
  __dirname,
  "../../db/migrations/add_call_card_fields.sql"
);

const ensureCallCardSchema = async (pool) => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  await pool.query(sql);
};

const saveCallCard = async (pool, card) => {
  if (!card || !card.callerNumber || !card.uniqueid) {
    console.error(
      "Карточка звонка без номера или Uniqueid не записана:",
      card && card.uniqueid
    );
    noteWork(pool, {
      process: "asterisk-server",
      kind: "mismatch",
      message: "Карточка звонка не записана: нет номера или Uniqueid",
      detail: card && card.uniqueid,
    });
    return null;
  }

  const result = await pool.query(
    `INSERT INTO calls (
       caller_number, receiver_number, accepted_at, status,
       direction, extension, uniqueid, talk_seconds, dialed_seconds, recording_path
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (uniqueid) DO UPDATE SET
       caller_number = EXCLUDED.caller_number,
       receiver_number = EXCLUDED.receiver_number,
       status = CASE
         WHEN calls.status = 'processed' THEN calls.status
         ELSE EXCLUDED.status
       END,
       direction = EXCLUDED.direction,
       extension = EXCLUDED.extension,
       talk_seconds = EXCLUDED.talk_seconds,
       dialed_seconds = EXCLUDED.dialed_seconds,
       recording_path = COALESCE(EXCLUDED.recording_path, calls.recording_path)
     RETURNING id`,
    [
      card.callerNumber,
      card.receiverNumber,
      card.startedAt || new Date(),
      card.status,
      card.direction,
      card.extension,
      card.uniqueid,
      card.talkSeconds,
      card.dialedSeconds,
      card.recordingPath,
    ]
  );

  return result.rows[0] ? result.rows[0].id : null;
};

module.exports = {
  ensureCallCardSchema,
  saveCallCard,
};
