// Один вид номера: +7, 8 и 7 сходятся в 7 и десять цифр.
// Добавочный из двух–пяти цифр остаётся как есть.

const hiddenNumber = /unknown|anonymous|private|restricted|unavailable/i;

const digitsOf = (value) => String(value).replace(/\D/g, "");

const normalizePhone = (value) => {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw || hiddenNumber.test(raw)) return null;
  const digits = digitsOf(raw);
  if (!digits) return null;
  if (digits.length <= 5) return digits;
  if (digits.length === 11 && digits.startsWith("8")) return `7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith("7")) return digits;
  if (digits.length === 10) return `7${digits}`;
  return digits;
};

const shortExtension = (value) => {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw || hiddenNumber.test(raw)) return null;

  const at = raw.match(/(?:^|\/)(\d{2,5})@/);
  if (at) return at[1];

  const sip = raw.match(/SIP\/(\d{2,5})(?:-|$)/i);
  if (sip) return sip[1];

  if (/^\d{2,5}$/.test(raw)) return raw;
  return null;
};

const externalNumber = (...values) => {
  for (const value of values) {
    const phone = normalizePhone(value);
    if (phone && phone.length > 5) return phone;
  }
  return null;
};

module.exports = {
  normalizePhone,
  shortExtension,
  externalNumber,
};
