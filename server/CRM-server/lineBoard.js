// Состояние линий сотрудников. Добавочный берётся из рабочего или стационарного номера.

const { readExtensionStatus } = require("../asterisk_server/extensionStatus");

const rank = { talking: 3, ringing: 2, free: 1 };
const byExtension = new Map();
let phonesAt = 0;
let phones = new Map();

const loadPhones = async (pool) => {
  if (phones.size && Date.now() - phonesAt < 60000) return phones;
  const result = await pool.query(
    `SELECT user_id, phone_number
     FROM user_phones
     WHERE phone_number ~ '^[0-9]{2,5}$'
       AND (
         phone_type ILIKE '%рабоч%'
         OR phone_type ILIKE '%стационар%'
       )`
  );
  const next = new Map();
  result.rows.forEach((row) => {
    const list = next.get(String(row.phone_number)) || [];
    list.push(row.user_id);
    next.set(String(row.phone_number), list);
  });
  phones = next;
  phonesAt = Date.now();
  return phones;
};

const combined = () => {
  const byUser = new Map();
  for (const [extension, state] of byExtension) {
    if (!state) continue;
    const users = phones.get(extension) || [];
    users.forEach((userId) => {
      const current = byUser.get(userId);
      if (!current || rank[state] > rank[current]) byUser.set(userId, state);
    });
  }
  return byUser;
};

const applyLine = async (pool, line) => {
  if (!line || !line.extension) return [];
  const extension = String(line.extension);
  if (line.state) byExtension.set(extension, line.state);
  else byExtension.delete(extension);
  await loadPhones(pool);
  const users = phones.get(extension) || [];
  const states = combined();
  return users.map((userId) => ({
    userId,
    state: states.get(userId) || null,
  }));
};

const applyExtensionEvent = async (pool, fields) => {
  const line = readExtensionStatus(fields);
  if (!line) return [];
  return applyLine(pool, line);
};

const snapshot = async (pool) => {
  await loadPhones(pool);
  return [...combined()].map(([userId, state]) => ({ userId, state }));
};

const resetLines = () => {
  byExtension.clear();
  phonesAt = 0;
};

module.exports = {
  applyLine,
  applyExtensionEvent,
  snapshot,
  resetLines,
};
