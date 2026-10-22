import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const outDir = path.join(projectRoot, 'dist-electron')

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })

await build({
  entryPoints: [path.join(projectRoot, 'electron/main.ts')],
  outfile: path.join(outDir, 'main.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron', './server.cjs'],
  logLevel: 'info',
})

await build({
  entryPoints: [path.join(projectRoot, 'server/app.ts')],
  outfile: path.join(outDir, 'server.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['better-sqlite3', 'express'],
  logLevel: 'info',
})
