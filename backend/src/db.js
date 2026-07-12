import pg from 'pg'
import { config } from './config.js'

export const pool = new pg.Pool({ connectionString: config.databaseUrl })

// Гарантирај UTF-8 на секоја нова врска, за да се чуваат правилно албанските
// (ë, ç) и сите други Unicode знаци, без разлика на стандардното кодирање на
// базата на Град Скопје.
pool.on('connect', (client) => {
  client.query("SET client_encoding TO 'UTF8'").catch(() => {})
})

export function query(text, params) {
  return pool.query(text, params)
}
