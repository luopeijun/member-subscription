import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let tempDir: string
let staticDir: string
let baseUrl: string
let stopServer: (server: import('node:http').Server) => Promise<void>
let server: import('node:http').Server

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'subledger-app-'))
  process.env.SUBLEDGER_DB_PATH = path.join(tempDir, 'test.db')
  staticDir = path.join(tempDir, 'dist')
  fs.mkdirSync(staticDir)
  fs.writeFileSync(
    path.join(staticDir, 'index.html'),
    '<!doctype html><html><body><div id="root"></div></body></html>',
  )

  const appModule = await import('../server/app')
  stopServer = appModule.stopServer
  const started = await appModule.startServer({ staticDir })
  server = started.server
  baseUrl = `http://${started.host}:${started.port}`
})

afterAll(async () => {
  await stopServer(server)
  fs.rmSync(tempDir, { recursive: true, force: true })
  delete process.env.SUBLEDGER_DB_PATH
})

describe('server app', () => {
  it('serves the API from the local server', async () => {
    const response = await fetch(`${baseUrl}/api/state`)
    expect(response.status).toBe(200)
    const state = await response.json()
    expect(state).toHaveProperty('services')
    expect(state).toHaveProperty('stats')
  })

  it('falls back to index.html for the single-page app', async () => {
    const response = await fetch(`${baseUrl}/compare`)
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('id="root"')
  })

  it('returns JSON errors for invalid API requests', async () => {
    const response = await fetch(`${baseUrl}/api/subscriptions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toHaveProperty('error')
  })
})
