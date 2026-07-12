import { query } from '../db.js'

// Го наоѓа корисникот по email; ако не постои, го креира (регистрирани корисници).
// Враќа UUID на корисникот или null ако нема email (анонимен — се кешира локално).
export async function resolveUserId(email, displayName = null) {
  if (!email) return null
  const { rows } = await query(
    `INSERT INTO users (email, display_name)
       VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE
       SET display_name = COALESCE(users.display_name, EXCLUDED.display_name)
     RETURNING id`,
    [email, displayName],
  )
  return rows[0]?.id || null
}
