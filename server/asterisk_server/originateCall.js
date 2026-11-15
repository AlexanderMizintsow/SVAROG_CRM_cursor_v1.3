// Набор из CRM в том виде, в каком станция уже принимает исходящий.
// Сначала звонит добавочный менеджера (Channel: SIP/103),
// после ответа выполняется from-internal-crm и номер дилера с восьмёрки.

const { normalizePhone } = require("./phoneNumber");

const stationNumber = (phone) => {
  const key = normalizePhone(phone);
  if (!key || !/^7\d{10}$/.test(key)) return null;
  return `8${key.slice(1)}`;
};

const buildOriginate = ({ extension, stationNumber: number, actionId }) => {
  const ext = String(extension || "").trim();
  const target = String(number || "").trim();
  const id = String(actionId || "").trim();
  if (!/^\d{2,5}$/.test(ext)) {
    const error = new Error("bad_extension");
    error.code = "bad_extension";
    throw error;
  }
  if (!/^8\d{10}$/.test(target)) {
    const error = new Error("bad_number");
    error.code = "bad_number";
    throw error;
  }
  if (!/^[\w.-]{1,64}$/.test(id)) {
    const error = new Error("bad_action");
    error.code = "bad_action";
    throw error;
  }

  const frame = [
    "Action: Originate",
    `ActionID: ${id}`,
    `Channel: SIP/${ext}`,
    "Context: from-internal-crm",
    `Exten: ${target}`,
    "Priority: 1",
    `CallerID: ${ext}`,
    "Timeout: 30000",
    "Async: true",
    "",
    "",
  ].join("\r\n");

  return { frame, actionId: id, extension: ext, stationNumber: target };
};

module.exports = {
  stationNumber,
  buildOriginate,
};
