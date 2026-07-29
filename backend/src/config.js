import 'dotenv/config'
import path from 'node:path'

export const config = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ekoskopje',
  // На Vercel фајл системот е read-only освен /tmp. Сликите на новите пријави
  // се чуваат во базата (BYTEA), па оваа папка е само за стари/локални фајлови.
  uploadDir: path.resolve(process.env.UPLOAD_DIR || (process.env.VERCEL ? '/tmp/uploads' : './uploads')),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || 'http://localhost:4000').replace(/\/$/, ''),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES) || 3 * 1024 * 1024,
  // Дозволени origin-и. Веб дев + Capacitor мобилни WebView origin-и.
  // CORS_ORIGIN може да биде листа разделена со запирки.
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
    .concat(['https://localhost', 'capacitor://localhost', 'http://localhost']),
  // Макс. фотографии по пријава (усогласено со frontend и колоните photo_1..photo_6)
  maxPhotos: 6,
  // Таен токен за админ операции (менување статус на пријава). Ако е празно,
  // заштитата е исклучена (згодно за локален развој). Постави го во продукција.
  adminToken: (process.env.ADMIN_TOKEN || '').trim(),
  // Сервисен клуч (JSON) за FCM HTTP v1 push. Може да е самиот JSON или патека
  // до .json фајлот. Ако е празно, push е исклучен (работат само локалните).
  // Го добиваш од Firebase Console → Project settings → Service accounts.
  fcmServiceAccount: (process.env.FCM_SERVICE_ACCOUNT || '').trim(),
  // Таен клуч за Vercel Cron (Authorization: Bearer …). Празно = без проверка (локално).
  cronSecret: (process.env.CRON_SECRET || '').trim(),
  // Brevo (Sendinblue) transactional email — forgot password. Бесплатен tier: ~300 emails/ден.
  // API key од Brevo → SMTP & API → API keys. Sender мора да е верификуван во Brevo.
  brevoApiKey: (process.env.BREVO_API_KEY || '').trim(),
  brevoSenderEmail: (process.env.BREVO_SENDER_EMAIL || '').trim(),
  brevoSenderName: (process.env.BREVO_SENDER_NAME || 'Еко Скопје').trim(),
  // Јавна адреса на frontend-от (за reset линк). Во prod: https://team2-zeta.vercel.app
  appPublicUrl: (process.env.APP_PUBLIC_URL || process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:5173').replace(/\/$/, ''),
}
