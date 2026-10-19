export function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function todayISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

export function nowISO(): string {
  return new Date().toISOString()
}

export function parseISO(value: string): number {
  const [year, month, day] = value.split('-').map(Number)
  return Date.UTC(year, (month || 1) - 1, day || 1)
}

export function formatISO(ms: number): string {
  const date = new Date(ms)
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseISO(to) - parseISO(from)) / 86_400_000)
}

export function addMonths(value: string, months: number): string {
  const [year, month, day] = value.split('-').map(Number)
  const targetIndex = month - 1 + months
  const targetYear = year + Math.floor(targetIndex / 12)
  const targetMonth = ((targetIndex % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const targetDay = Math.min(day, lastDay)
  return `${targetYear}-${pad2(targetMonth + 1)}-${pad2(targetDay)}`
}

export function addDays(value: string, days: number): string {
  return formatISO(parseISO(value) + days * 86_400_000)
}

export function isISODate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function icsDate(value: string): string {
  return value.replaceAll('-', '')
}

export function icsStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}
