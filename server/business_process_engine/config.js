require('dotenv').config()

module.exports = {
  port: process.env.PORT || 5010,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'Svarog',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },
  registerApiUrl: process.env.REGISTER_API_URL, //|| 'http://localhost:5000',
  tgBotApiUrl: process.env.TG_BOT_API_URL, //|| 'http://localhost:5777',
 
  allowedProcessDesignerRoleIds: process.env.ALLOWED_PROCESS_DESIGNER_ROLE_IDS
    ? process.env.ALLOWED_PROCESS_DESIGNER_ROLE_IDS.split(',').map(Number).filter(Boolean)
    : [],
  allowedProcessDesignerUserIds: process.env.ALLOWED_PROCESS_DESIGNER_USER_IDS
    ? process.env.ALLOWED_PROCESS_DESIGNER_USER_IDS.split(',').map(Number).filter(Boolean)
    : [],
}
