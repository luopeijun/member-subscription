import fs from 'node:fs'
import path from 'node:path'

export function resolveDataDir(override: string | undefined, defaultDir: string): string {
  const trimmed = override?.trim()
  return trimmed ? path.resolve(trimmed) : defaultDir
}

export function findLegacyDatabase(
  targetDbPath: string,
  candidates: string[],
): string | null {
  const target = path.resolve(targetDbPath)
  for (const candidate of candidates) {
    if (path.resolve(candidate) === target) continue
    try {
      if (fs.statSync(candidate).isFile()) return candidate
    } catch {
      // 路径不存在时继续检查下一个候选位置。
    }
  }
  return null
}

export async function importDatabase(
  sourceDbPath: string,
  targetDbPath: string,
): Promise<void> {
  if (path.resolve(sourceDbPath) === path.resolve(targetDbPath)) return

  fs.mkdirSync(path.dirname(targetDbPath), { recursive: true })
  const suffixes = ['', '-wal', '-shm']
  try {
    fs.rmSync(`${targetDbPath}-wal`, { force: true })
    fs.rmSync(`${targetDbPath}-shm`, { force: true })
    for (const suffix of suffixes) {
      const source = `${sourceDbPath}${suffix}`
      if (fs.existsSync(source)) {
        fs.copyFileSync(source, `${targetDbPath}${suffix}`)
      }
    }
  } catch (error) {
    for (const suffix of suffixes) {
      fs.rmSync(`${targetDbPath}${suffix}`, { force: true })
    }
    throw new Error(
      `导入旧版数据失败：${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

export function isSameOrigin(url: string, baseUrl: string): boolean {
  try {
    return new URL(url).origin === new URL(baseUrl).origin
  } catch {
    return false
  }
}
