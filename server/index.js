import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import Database from 'better-sqlite3'

const app = new Hono()
const db = new Database('records.db')

// Setup DB
db.exec(`
  CREATE TABLE IF NOT EXISTS records (
    uuid TEXT PRIMARY KEY,
    data TEXT,
    updatedAt INTEGER
  );
`)

app.use('/*', cors())

app.get('/', (c) => c.text('Record Manager Sync Server is Running!'))

// Sync Endpoint
app.post('/sync', async (c) => {
  const body = await c.req.json()
  const { changes, lastSync } = body
  
  // 1. Apply client changes (Upsert)
  const upsert = db.prepare(`
    INSERT INTO records (uuid, data, updatedAt) 
    VALUES (@uuid, @data, @updatedAt)
    ON CONFLICT(uuid) DO UPDATE SET
      data = excluded.data,
      updatedAt = excluded.updatedAt
    WHERE excluded.updatedAt > records.updatedAt
  `)

  const applied = 0
  const insertTx = db.transaction((items) => {
    for (const item of items) {
      // Ensure we only accept newer changes
      upsert.run({
        uuid: item.uuid,
        data: JSON.stringify(item),
        updatedAt: item.updatedAt
      })
    }
  })

  if (changes && changes.length > 0) {
    insertTx(changes)
  }

  // 2. Fetch server changes since lastSync
  const stmt = db.prepare('SELECT data FROM records WHERE updatedAt > ?')
  const rows = stmt.all(lastSync || 0)
  
  const serverChanges = rows.map(r => JSON.parse(r.data))

  return c.json({
    pushed: changes.length,
    pulled: serverChanges,
    serverTime: Date.now()
  })
})

const port = 3000
console.log(`Server running on port ${port}`)

serve({
  fetch: app.fetch,
  port
})
