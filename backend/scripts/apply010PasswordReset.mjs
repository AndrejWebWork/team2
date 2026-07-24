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
await client.query(readFileSync(join(root, 'db/migrations/010_password_reset_tokens.sql'), 'utf8'))
const { rows } = await client.query(
  `SELECT table_name FROM information_schema.tables WHERE table_name='password_reset_tokens'`,
)
console.log(rows.length ? 'Migration 010 applied: password_reset_tokens table exists.' : 'Migration 010 failed.')
await client.end()
