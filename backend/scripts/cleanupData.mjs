import 'dotenv/config'
import pg from 'pg'
const c = new pg.Client({ connectionString: process.env.DATABASE_URL })
await c.connect()

// Останаа само трите дозволени типови контејнери (одлука на корисникот).
const kinds = await c.query(
  `DELETE FROM container_kinds WHERE id NOT IN ('mesan', 'podzemen', 'kabast') RETURNING id`,
)
console.log('removed container_kinds:', kinds.rows.map((r) => r.id).join(', ') || '(none)')

// Синтетички тест сметки од развојот (email со +timestamp).
const users = await c.query(
  `DELETE FROM users WHERE email IN ('marko.test+774255251@ekoskopje.mk', 'ana.test+1622941043@ekoskopje.mk') RETURNING email`,
)
console.log('removed test users:', users.rows.map((r) => r.email).join(', ') || '(none)')

await c.end()
