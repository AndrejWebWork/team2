import 'dotenv/config'
import pg from 'pg'
const c = new pg.Client({ connectionString: process.env.DATABASE_URL })
await c.connect()

console.log('=== container_kinds ===')
console.table((await c.query('SELECT id, label FROM container_kinds ORDER BY id')).rows)

console.log('=== users (email, role, points, anonymous) ===')
console.table((await c.query('SELECT email, display_name, role, points, is_anonymous FROM users ORDER BY created_at')).rows)

console.log('=== institutions ===')
console.table((await c.query('SELECT id, label, is_active FROM institutions ORDER BY id')).rows)

await c.end()
