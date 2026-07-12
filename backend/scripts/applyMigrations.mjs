// Применува заостанати миграции (005, 006) врз живата база — идемпотентно.
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

async function colType(table, col) {
  const { rows } = await client.query(
    `SELECT udt_name FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`,
    [table, col],
  )
  return rows[0]?.udt_name || null
}

// 005 — users.points
if (!(await colType('users', 'points'))) {
  console.log('Applying 005_users_points.sql ...')
  await client.query(readFileSync(join(root, 'db/migrations/005_users_points.sql'), 'utf8'))
  console.log('  done')
} else {
  console.log('005 already applied')
}

// 006 — BYTEA photos (проверка по колона, за да е идемпотентно)
if ((await colType('reports', 'photo_1')) !== 'bytea') {
  console.log('Applying 006 (reports photos → BYTEA) ...')
  for (let n = 1; n <= 6; n++) {
    await client.query(`ALTER TABLE reports ALTER COLUMN photo_${n} TYPE BYTEA USING NULL`)
  }
  console.log('  done')
} else {
  console.log('006 reports already applied')
}

if (await colType('users', 'avatar_url')) {
  console.log('Applying 006 (users.avatar_url → avatar BYTEA) ...')
  await client.query(`ALTER TABLE users RENAME COLUMN avatar_url TO avatar`)
  await client.query(`ALTER TABLE users ALTER COLUMN avatar TYPE BYTEA USING NULL`)
  console.log('  done')
} else {
  console.log('006 users already applied')
}

if (await colType('events', 'cover_photo_url')) {
  console.log('Applying 006 (events.cover_photo_url → cover_photo BYTEA) ...')
  await client.query(`ALTER TABLE events RENAME COLUMN cover_photo_url TO cover_photo`)
  await client.query(`ALTER TABLE events ALTER COLUMN cover_photo TYPE BYTEA USING NULL`)
  console.log('  done')
} else {
  console.log('006 events already applied')
}

await client.end()
console.log('All migrations up to date.')
