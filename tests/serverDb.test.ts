import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let tempDir: string
let dbModule: typeof import('../server/db')

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'subledger-db-'))
  process.env.SUBLEDGER_DB_PATH = path.join(tempDir, 'nested', 'app.db')
  dbModule = await import('../server/db')
})

afterAll(() => {
  dbModule.closeDb()
  fs.rmSync(tempDir, { recursive: true, force: true })
  delete process.env.SUBLEDGER_DB_PATH
})

describe('server database lifecycle', () => {
  it('creates the configured database, enables WAL, and closes cleanly', () => {
    const expectedPath = path.resolve(path.join(tempDir, 'nested', 'app.db'))
    expect(dbModule.dbPath).toBe(expectedPath)
    expect(fs.existsSync(expectedPath)).toBe(true)
    expect(dbModule.db.pragma('journal_mode', { simple: true })).toBe('wal')
    expect(dbModule.db.pragma('foreign_keys', { simple: true })).toBe(1)

    const tables = dbModule.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[]
    const tableNames = tables.map((table) => table.name)
    expect(tableNames).toContain('services')
    expect(tableNames).toContain('subscriptions')

    expect(dbModule.db.open).toBe(true)
    dbModule.closeDb()
    expect(dbModule.db.open).toBe(false)
    dbModule.closeDb()
  })
})
