import { execFileSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { restoreNodeSqlite, useElectronSqlite } from './electron-native.mjs'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

execFileSync(npm, ['run', 'build:desktop'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

let shouldRestore = false
try {
  shouldRestore = true
  useElectronSqlite()
  const result = spawnSync(electronPath, ['.', ...process.argv.slice(2)], {
    cwd: projectRoot,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exitCode = result.status ?? 1
} finally {
  if (shouldRestore) {
    try {
      restoreNodeSqlite()
    } catch (error) {
      console.error('[desktop] 恢复 Node.js 原生模块失败：', error)
      process.exitCode = 1
    }
  }
}
