export const API_BASE_URL = 'http://localhost:' //'http://192.168.57.112:' - рабочий
// Движок бизнес-процессов (отдельный сервис)
export const BPE_API_BASE_URL = 'http://localhost:5010'
//'http://192.168.57.112:'; http://localhost:
export const appTypeBuild = false

/** Базовый URL сервиса mobile_app (чат по рекламации, загрузка превью). */
export const MOBILE_APP_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MOBILE_APP_BASE_URL) || 'http://localhost:5011'
/** Тот же секрет, что COMPLAINT_MANAGER_CHAT_SECRET в .env mobile_app (только для доверенных сборок CRM). */
export const COMPLAINT_MANAGER_CHAT_SECRET =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_COMPLAINT_MANAGER_CHAT_SECRET) || ''
