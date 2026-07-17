import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { pool } from '../src/db.js'
import { hashForStorage } from '../src/lib/clientPassword.js'

// Поставува bcrypt-хеширана лозинка за админ сметката (SHA-256 на клиентот → bcrypt во база).
// Употреба:
//   ADMIN_PASSWORD=тајна ADMIN_EMAIL=admin@ekoskopje.mk node scripts/setAdminPassword.js
const email = (process.env.ADMIN_EMAIL || 'admin@ekoskopje.mk').trim()
const password = process.env.ADMIN_PASSWORD

async function run() {
  if (!password || password.length < 6) {
    console.error('Постави ADMIN_PASSWORD (мин. 6 карактери) во околината.')
    process.exit(1)
  }
  const clientHash = crypto.createHash('sha256').update(String(password)).digest('hex')
  const hash = await hashForStorage(clientHash)
  const { rowCount } = await pool.query(
    `UPDATE users SET password_hash = $1, updated_at = now() WHERE email = $2`,
    [hash, email],
  )
  if (rowCount === 0) {
    // Ако админот не е seed-нат, креирај го.
    await pool.query(
      `INSERT INTO users (email, display_name, role, is_anonymous, password_hash)
       VALUES ($1, 'Администратор', 'admin', FALSE, $2)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [email, hash],
    )
  }
  console.log(`Лозинката за ${email} е поставена.`)
  await pool.end()
}

run().catch((err) => {
  console.error('Грешка:', err.message)
  process.exit(1)
})
