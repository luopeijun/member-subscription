import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  findLegacyDatabase,
  importDatabase,
  isSameOrigin,
  resolveDataDir,
} from '../electron/desktop'

let tempDir: string

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'subledger-desktop-'))
})

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true })
})

describe('desktop data helpers', () => {
  it('resolves the data directory override and falls back to the default', () => {
    const defaultDir = path.join(tempDir, 'default', 'data')
    const overrideDir = path.join(tempDir, 'custom', 'data')

    expect(resolveDataDir(undefined, defaultDir)).toBe(defaultDir)
    expect(resolveDataDir('   ', defaultDir)).toBe(defaultDir)
    expect(resolveDataDir(`  ${overrideDir}  `, defaultDir)).toBe(path.resolve(overrideDir))
  })

  it('finds the first existing legacy database and skips the target', () => {
    const target = path.join(tempDir, 'target', 'app.db')
    const oldDb = path.join(tempDir, 'old', 'app.db')
    const otherDb = path.join(tempDir, 'other', 'app.db')
    fs.mkdirSync(path.dirname(oldDb), { recursive: true })
    fs.mkdirSync(path.dirname(otherDb), { recursive: true })
    fs.writeFileSync(oldDb, 'old')
    fs.writeFileSync(otherDb, 'other')

    expect(
      findLegacyDatabase(target, [
        path.join(tempDir, 'missing', 'app.db'),
        path.join(tempDir, 'old'),
        target,
        oldDb,
        otherDb,
      ]),
    ).toBe(oldDb)
    expect(findLegacyDatabase(target, [target])).toBeNull()
    expect(findLegacyDatabase(target, [path.join(tempDir, 'old')])).toBeNull()
  })

  it('copies the database with its WAL and SHM files', async () => {
    const source = path.join(tempDir, 'source', 'app.db')
    const target = path.join(tempDir, 'target', 'nested', 'app.db')
    fs.mkdirSync(path.dirname(source), { recursive: true })
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(source, 'source-main')
    fs.writeFileSync(`${source}-wal`, 'source-wal')
    fs.writeFileSync(`${source}-shm`, 'source-shm')
    fs.writeFileSync(target, 'stale-main')
    fs.writeFileSync(`${target}-wal`, 'stale-wal')
    fs.writeFileSync(`${target}-shm`, 'stale-shm')

    await importDatabase(source, target)

    expect(fs.readFileSync(target, 'utf8')).toBe('source-main')
    expect(fs.readFileSync(`${target}-wal`, 'utf8')).toBe('source-wal')
    expect(fs.readFileSync(`${target}-shm`, 'utf8')).toBe('source-shm')
    expect(fs.readFileSync(source, 'utf8')).toBe('source-main')
  })

  it('removes stale WAL and SHM files when the source has none', async () => {
    const source = path.join(tempDir, 'source', 'app.db')
    const target = path.join(tempDir, 'target', 'app.db')
    fs.mkdirSync(path.dirname(source), { recursive: true })
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(source, 'source-main')
    fs.writeFileSync(target, 'stale-main')
    fs.writeFileSync(`${target}-wal`, 'stale-wal')
    fs.writeFileSync(`${target}-shm`, 'stale-shm')

    await importDatabase(source, target)

    expect(fs.readFileSync(target, 'utf8')).toBe('source-main')
    expect(fs.existsSync(`${target}-wal`)).toBe(false)
    expect(fs.existsSync(`${target}-shm`)).toBe(false)
  })

  it('does nothing when source and target are the same database', async () => {
    const source = path.join(tempDir, 'app.db')
    fs.writeFileSync(source, 'main')

    await importDatabase(source, source)

    expect(fs.readFileSync(source, 'utf8')).toBe('main')
  })

  it('cleans up a partial target when copying fails', async () => {
    const source = path.join(tempDir, 'source', 'app.db')
    const target = path.join(tempDir, 'target', 'app.db')
    fs.mkdirSync(path.dirname(source), { recursive: true })
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(source, 'source-main')
    fs.mkdirSync(`${source}-wal`)
    fs.writeFileSync(target, 'stale-main')
    fs.writeFileSync(`${target}-wal`, 'stale-wal')
    fs.writeFileSync(`${target}-shm`, 'stale-shm')

    await expect(importDatabase(source, target)).rejects.toThrow('导入旧版数据失败')

    expect(fs.existsSync(target)).toBe(false)
    expect(fs.existsSync(`${target}-wal`)).toBe(false)
    expect(fs.existsSync(`${target}-shm`)).toBe(false)
  })

  it('only treats same-origin URLs as internal', () => {
    const base = 'http://127.0.0.1:4173'

    expect(isSameOrigin('http://127.0.0.1:4173/compare', base)).toBe(true)
    expect(isSameOrigin('http://127.0.0.1:4173', base)).toBe(true)
    expect(isSameOrigin('http://127.0.0.1:4174/compare', base)).toBe(false)
    expect(isSameOrigin('https://127.0.0.1:4173/compare', base)).toBe(false)
    expect(isSameOrigin('not a url', base)).toBe(false)
  })
})
