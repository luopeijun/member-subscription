import express, { type Express } from 'express'
import type { Server } from 'node:http'
import path from 'node:path'
import { apiRouter } from './api'
import { closeDb } from './db'

export function createApp(staticDir: string): Express {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '2mb' }))
  app.use('/api', apiRouter)
  app.use(express.static(staticDir))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'))
  })
  return app
}

export interface StartServerOptions {
  staticDir: string
  host?: string
  port?: number
}

export interface StartedServer {
  server: Server
  host: string
  port: number
}

export function startServer(options: StartServerOptions): Promise<StartedServer> {
  const host = options.host ?? '127.0.0.1'
  const port = options.port ?? 0
  const app = createApp(options.staticDir)

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host)
    server.once('error', reject)
    server.once('listening', () => {
      server.off('error', reject)
      const address = server.address()
      resolve({
        server,
        host,
        port: typeof address === 'object' && address ? address.port : port,
      })
    })
  })
}

export function stopServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      closeDb()
      if (error) reject(error)
      else resolve()
    })
  })
}
