// Целосна ревизија на живата база: табели, колони, типови, индекси, погледи,
// ENUM-и, тригери и надворешни клучеви — за споредба со db/schema.sql.
import 'dotenv/config'
import pg from 'pg'

const c = new pg.Client({ connectionString: process.env.DATABASE_URL })
await c.connect()

const { rows: tables } = await c.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name
`)
console.log('=== TABLES ===')
console.log(tables.map((t) => t.table_name).join(', '))

for (const { table_name } of tables) {
  const { rows: cols } = await c.query(`
    SELECT column_name, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [table_name])
  console.log(`\n--- ${table_name} ---`)
  for (const col of cols) {
    console.log(`  ${col.column_name} :: ${col.udt_name} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}${col.column_default ? ' DEFAULT ' + col.column_default : ''}`)
  }
}

console.log('\n=== VIEWS ===')
const { rows: views } = await c.query(`
  SELECT table_name FROM information_schema.views WHERE table_schema = 'public'
`)
console.log(views.map((v) => v.table_name).join(', ') || '(none)')

console.log('\n=== ENUMS ===')
const { rows: enums } = await c.query(`
  SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
  FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
  GROUP BY t.typname ORDER BY t.typname
`)
for (const e of enums) console.log(`  ${e.typname}: ${Array.isArray(e.labels) ? '[' + e.labels.join(', ') + ']' : e.labels}`)

console.log('\n=== INDEXES ===')
const { rows: idx } = await c.query(`
  SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public'
  ORDER BY tablename, indexname
`)
for (const i of idx) console.log(`  ${i.tablename}: ${i.indexname}`)

console.log('\n=== TRIGGERS ===')
const { rows: trg } = await c.query(`
  SELECT event_object_table AS tbl, trigger_name FROM information_schema.triggers
  WHERE trigger_schema = 'public' GROUP BY 1, 2 ORDER BY 1
`)
for (const t of trg) console.log(`  ${t.tbl}: ${t.trigger_name}`)

console.log('\n=== FOREIGN KEYS ===')
const { rows: fks } = await c.query(`
  SELECT conrelid::regclass AS tbl, conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint WHERE contype = 'f' ORDER BY conrelid::regclass::text
`)
for (const f of fks) console.log(`  ${f.tbl}: ${f.def}`)

console.log('\n=== CHECK CONSTRAINTS ===')
const { rows: checks } = await c.query(`
  SELECT conrelid::regclass AS tbl, pg_get_constraintdef(oid) AS def
  FROM pg_constraint WHERE contype = 'c' AND connamespace = 'public'::regnamespace
  ORDER BY conrelid::regclass::text
`)
for (const ch of checks) console.log(`  ${ch.tbl}: ${ch.def}`)

console.log('\n=== ROW COUNTS ===')
for (const { table_name } of tables) {
  const { rows: [{ n }] } = await c.query(`SELECT count(*)::int AS n FROM "${table_name}"`)
  console.log(`  ${table_name}: ${n}`)
}

await c.end()
