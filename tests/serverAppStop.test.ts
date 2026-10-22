import fs from 'node:fs'
import type { Server } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let tempDir: string
let appModule: typeof import('../server/app')
let dbModule: typeof import('../server/db')

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'subledger-stop-'))
  process.env.SUBLEDGER_DB_PATH = path.join(tempDir, 'test.db')
  dbModule = await import('../server/db')
  appModule = await import('../server/app')
})

afterAll(() => {
  dbModule.closeDb()
  fs.rmSync(tempDir, { recursive: true, force: true })
  delete process.env.SUBLEDGER_DB_PATH
})

describe('server shutdown', () => {
  it('reports close errors and still closes the database', async () => {
    const server = {
      close(callback: (error?: Error) => void) {
        callback(new Error('close failed'))
      },
    } as unknown as Server

    await expect(appModule.stopServer(server)).rejects.toThrow('close failed')
    expect(dbModule.db.open).toBe(false)
  })
})
