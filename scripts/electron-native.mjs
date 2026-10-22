import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const electronVersion = require('electron/package.json').version
const moduleDir = path.join(projectRoot, 'node_modules', 'better-sqlite3')
const binaryPath = path.join(moduleDir, 'build', 'Release', 'better_sqlite3.node')
const backupPath = path.join(
  projectRoot,
  'node_modules',
  '.cache',
  'member-subscription',
  'better_sqlite3.node',
)

export function useElectronSqlite() {
  if (!fs.existsSync(binaryPath)) {
    throw new Error(`找不到 better-sqlite3 原生模块：${binaryPath}`)
  }

  fs.mkdirSync(path.dirname(backupPath), { recursive: true })
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(binaryPath, backupPath)
  }

  const prebuildInstall = path.join(
    projectRoot,
    'node_modules',
    'prebuild-install',
    'bin.js',
  )
  if (!fs.existsSync(prebuildInstall)) {
    throw new Error('找不到 prebuild-install，请先运行 npm install。')
  }

  console.log(`[desktop] 下载 better-sqlite3 的 Electron ${electronVersion} 预编译模块`)
  execFileSync(
    process.execPath,
    [
      prebuildInstall,
      '--runtime=electron',
      `--target=${electronVersion}`,
      '--arch=x64',
      '--platform=win32',
      '--verbose',
    ],
    { cwd: moduleDir, stdio: 'inherit' },
  )

  if (!fs.existsSync(binaryPath)) {
    throw new Error('better-sqlite3 的 Electron 预编译模块安装失败。')
  }
}

export function restoreNodeSqlite() {
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, binaryPath)
    fs.rmSync(backupPath, { force: true })
    console.log('[desktop] 已恢复 better-sqlite3 的 Node.js 原生模块')
    return
  }

  console.log('[desktop] 未找到本地备份，重新安装 Node.js 版 better-sqlite3')
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  execFileSync(npm, ['rebuild', 'better-sqlite3'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const action = process.argv[2]
  if (action === 'use') {
    useElectronSqlite()
  } else if (action === 'restore') {
    restoreNodeSqlite()
  } else {
    console.error('用法：node scripts/electron-native.mjs <use|restore>')
    process.exitCode = 1
  }
}
