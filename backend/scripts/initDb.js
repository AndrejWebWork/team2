import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from '../src/db.js'

const dir = path.dirname(fileURLToPath(import.meta.url))
const dbDir = path.join(dir, '..', 'db')

async function run() {
  const schema = fs.readFileSync(path.join(dbDir, 'schema.sql'), 'utf8')
  const seed = fs.readFileSync(path.join(dbDir, 'seed_reference.sql'), 'utf8')
  const client = await pool.connect()
  try {
    console.log('Креирање шема...')
    await client.query(schema)
    console.log('Внесување референтни податоци...')
    await client.query(seed)
    console.log('Базата е иницијализирана успешно.')
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch((err) => {
  console.error('Грешка при иницијализација:', err.message)
  process.exit(1)
})
