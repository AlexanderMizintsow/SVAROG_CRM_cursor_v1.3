// Короткая запись сбоя. Ошибка журнала не должна останавливать звонок.

const clip = (value, limit) => {
  if (value == null || value === "") return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > limit ? text.slice(0, limit) : text;
};

const noteWork = async (pool, entry) => {
  if (!pool || !entry || !entry.message) return;
  try {
    await pool.query(
      `INSERT INTO crm_work_log (process, kind, message, detail)
       VALUES ($1, $2, $3, $4)`,
      [
        clip(entry.process || "CRM", 40),
        clip(entry.kind || "error", 40),
        clip(entry.message, 500),
        clip(entry.detail, 500),
      ]
    );
  } catch (error) {
    console.error("Журнал работы не записан:", error.message);
  }
};

module.exports = { noteWork };
