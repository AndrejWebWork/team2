// Привремена дијагностика: ја прикажува живата структура на табелата `users`.
import 'dotenv/config'
import pg from 'pg'

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })

try {
  await client.connect()

  const { rows: cols } = await client.query(`
    SELECT ordinal_position AS "#", column_name, data_type, udt_name,
           is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'users'
    ORDER BY ordinal_position
  `)
  console.log('=== users columns (live) ===')
  console.table(cols)

  const { rows: idx } = await client.query(`
    SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users'
  `)
  console.log('=== indexes ===')
  for (const i of idx) console.log(`- ${i.indexname}: ${i.indexdef}`)

  const { rows: [stats] } = await client.query(`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE role = 'admin')::int AS admins,
           count(*) FILTER (WHERE role = 'organization')::int AS orgs,
           coalesce(sum(points), 0)::int AS total_points
    FROM users
  `)
  console.log('=== data ===')
  console.log(stats)
} catch (err) {
  console.error('ERROR:', err.message)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
