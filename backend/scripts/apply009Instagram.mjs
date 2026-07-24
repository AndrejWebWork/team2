import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const conn = process.argv[2] || process.env.DATABASE_URL
if (!conn) {
  console.error('Missing DATABASE_URL')
  process.exit(1)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const client = new pg.Client({
  connectionString: conn,
  ssl: /neon\.tech|sslmode=require/.test(conn) ? { rejectUnauthorized: false } : undefined,
})

await client.connect()
await client.query(readFileSync(join(root, 'db/migrations/009_users_instagram.sql'), 'utf8'))
const { rows } = await client.query(
  `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='users' AND column_name='instagram_handle'`,
)
console.log(rows.length ? 'Migration 009 applied: instagram_handle column exists.' : 'Migration 009 failed.')
console.log(rows)
await client.end()
