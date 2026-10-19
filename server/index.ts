import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { apiRouter } from './api'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const isProduction = process.argv.includes('--prod')

const app = express()
app.use(express.json({ limit: '2mb' }))
app.use('/api', apiRouter)

if (isProduction) {
  const dist = path.join(root, 'dist')
  app.use(express.static(dist))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'))
  })
} else {
  const { createServer } = await import('vite')
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  })
  app.use(vite.middlewares)
}

const port = Number(process.env.PORT || 5173)
const host = process.env.HOST || '127.0.0.1'

app.listen(port, host, () => {
  console.log(`\n  会员订阅已启动：http://localhost:${port}\n`)
})
