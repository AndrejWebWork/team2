// Дијагностика: проверува кои миграции се применети на живата база.
import 'dotenv/config'
import pg from 'pg'

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

async function colType(table, col) {
  const { rows } = await client.query(
    `SELECT udt_name FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`,
    [table, col],
  )
  return rows[0]?.udt_name || null
}
async function tableExists(t) {
  const { rows } = await client.query(`SELECT to_regclass($1) AS r`, [`public.${t}`])
  return !!rows[0].r
}

console.log('001 nearest_point (reports.nearest_point_id):', await colType('reports', 'nearest_point_id') ? 'APPLIED' : 'MISSING')
console.log('003 municipality (reports.municipality):', await colType('reports', 'municipality') ? 'APPLIED' : 'MISSING')
console.log('004 device_tokens table:', await tableExists('device_tokens') ? 'APPLIED' : 'MISSING')
console.log('005 users.points:', await colType('users', 'points') ? 'APPLIED' : 'MISSING')
console.log('006 photos BYTEA (reports.photo_1):', await colType('reports', 'photo_1'))
console.log('006 users avatar:', await colType('users', 'avatar') ? 'renamed (' + await colType('users', 'avatar') + ')' : 'still avatar_url (' + await colType('users', 'avatar_url') + ')')
console.log('006 events cover_photo:', await colType('events', 'cover_photo') || 'still cover_photo_url (' + await colType('events', 'cover_photo_url') + ')')

await client.end()
