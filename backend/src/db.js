import pg from 'pg'
import { config } from './config.js'

// Cloud Postgres (Neon/Supabase/RDS) бара SSL; локалниот развој не. Одлучуваме
// според хостот во DATABASE_URL, освен ако не е зададено PGSSL=disable/require.
function sslFor(url) {
  const mode = (process.env.PGSSL || '').toLowerCase()
  if (mode === 'disable') return false
  if (mode === 'require') return { rejectUnauthorized: false }
  return /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }
}

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: sslFor(config.databaseUrl),
  // Serverless опкружувања (Vercel) држат мал број конекции по инстанца.
  max: Number(process.env.PG_POOL_MAX) || 5,
})

// Гарантирај UTF-8 на секоја нова врска, за да се чуваат правилно албанските
// (ë, ç) и сите други Unicode знаци, без разлика на стандардното кодирање на
// базата на Град Скопје.
pool.on('connect', (client) => {
  client.query("SET client_encoding TO 'UTF8'").catch(() => {})
})

export function query(text, params) {
  return pool.query(text, params)
}
