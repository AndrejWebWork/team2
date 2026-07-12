import 'dotenv/config'
import pg from 'pg'

// Ја креира базата од DATABASE_URL ако не постои (се поврзува на служ. база `postgres`).
const url = new URL(process.env.DATABASE_URL)
const dbName = url.pathname.replace(/^\//, '')
const adminUrl = new URL(process.env.DATABASE_URL)
adminUrl.pathname = '/postgres'

const pool = new pg.Pool({ connectionString: adminUrl.toString() })
try {
  const exists = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName])
  if (exists.rowCount > 0) {
    console.log(`Базата "${dbName}" веќе постои.`)
  } else {
    await pool.query(`CREATE DATABASE "${dbName}" ENCODING 'UTF8'`)
    console.log(`Базата "${dbName}" е креирана.`)
  }
} catch (err) {
  console.error('Грешка при креирање:', err.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
