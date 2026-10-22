import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { restoreNodeSqlite, useElectronSqlite } from './electron-native.mjs'

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const builder = path.join(projectRoot, 'node_modules', 'electron-builder', 'cli.js')
const releaseDir = path.join(projectRoot, 'release')

process.env.ELECTRON_MIRROR ??= 'https://npmmirror.com/mirrors/electron/'
process.env.ELECTRON_BUILDER_BINARIES_MIRROR ??=
  'https://npmmirror.com/mirrors/electron-builder-binaries/'

let failure = null
let shouldRestore = false

try {
  execFileSync(npm, ['run', 'build:desktop'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  shouldRestore = true
  useElectronSqlite()

  execFileSync(
    process.execPath,
    [builder, '--win', '--publish', 'never'],
    {
      cwd: projectRoot,
      env: process.env,
      stdio: 'inherit',
    },
  )

  const artifacts = fs
    .readdirSync(releaseDir)
    .filter((name) => name.endsWith('.exe'))
  console.log('\n[desktop] 安装包已生成：')
  for (const artifact of artifacts) {
    console.log(`  ${path.join(releaseDir, artifact)}`)
  }
} catch (error) {
  failure = error
} finally {
  if (shouldRestore) {
    try {
      restoreNodeSqlite()
    } catch (error) {
      console.error('[desktop] 恢复 Node.js 原生模块失败：', error)
      if (!failure) failure = error
    }
  }
}

if (failure) throw failure
