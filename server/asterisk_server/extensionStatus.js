// Занятость добавочного из события ExtensionStatus.
// 0 свободен, 8 звонит, 1 говорит. 2 и 16 тоже занятая линия.

const lineState = (status) => {
  const code = String(status == null ? "" : status).trim();
  if (code === "0") return "free";
  if (code === "8") return "ringing";
  if (code === "1" || code === "2" || code === "16") return "talking";
  return null;
};

const readExtensionStatus = (fields) => {
  if (!fields || fields.Event !== "ExtensionStatus") return null;
  if (fields.Context && fields.Context !== "ext-local") return null;
  const extension = String(fields.Exten || "").trim();
  if (!/^\d{2,5}$/.test(extension)) return null;
  return { extension, state: lineState(fields.Status) };
};

module.exports = {
  lineState,
  readExtensionStatus,
};
