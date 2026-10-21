import { MAX_DURATION_DAYS } from '../shared/duration'
import { HttpError } from './errors'
import { isISODate } from './util'

const STATUSES = new Set(['active', 'expired', 'planned'])

export function text(value: unknown, label: string, max = 120): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `请填写${label}`)
  }
  return value.trim().slice(0, max)
}

export function optionalText(value: unknown, max = 300): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed || null
}

export function integer(
  value: unknown,
  label: string,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new HttpError(400, `${label}必须是整数`)
  }
  if (parsed < min || parsed > max) {
    throw new HttpError(400, `${label}超出允许范围`)
  }
  return parsed
}

export function date(value: unknown, label: string): string {
  if (!isISODate(value)) {
    throw new HttpError(400, `${label}格式应为 YYYY-MM-DD`)
  }
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new HttpError(400, `${label}不是有效日期`)
  }
  return value
}

export function maybeDate(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === '') return null
  return date(value, label)
}

export function status(value: unknown): string {
  if (typeof value !== 'string' || !STATUSES.has(value)) {
    throw new HttpError(400, '状态不正确')
  }
  return value
}

const CYCLE_MONTHS = new Set([-1, 0, 1, 3, 6, 12, 24])

export function cycle(value: unknown): number {
  const months = integer(value, '周期', -1, 120)
  if (!CYCLE_MONTHS.has(months)) {
    throw new HttpError(
      400,
      '计费周期只能是 1 天、1 周、月付、季付、半年付、年付、2 年、一次性付费或买断',
    )
  }
  return months
}

export function cycleDays(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  return integer(value, '周期天数', 1, 3650)
}

export function quoteDurationDays(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  return integer(value, '套餐总时长（天）', 1, MAX_DURATION_DAYS)
}

export type Cycle = {
  cycleMonths: number
  cycleDays: number | null
}

export function parseCycle(
  body: Record<string, unknown>,
  fallback: Cycle,
): Cycle {
  // 明确传了天数就以天数为准；传 null / 空字符串表示改回月周期。
  if (body.cycleDays !== undefined) {
    const days = cycleDays(body.cycleDays)
    if (days !== null) return { cycleMonths: 0, cycleDays: days }
  }
  if (body.cycleMonths !== undefined) {
    return { cycleMonths: cycle(body.cycleMonths), cycleDays: null }
  }
  const fallbackDays = cycleDays(fallback.cycleDays)
  if (fallbackDays !== null) return { cycleMonths: 0, cycleDays: fallbackDays }
  return { cycleMonths: cycle(fallback.cycleMonths), cycleDays: null }
}

export type QuoteInput = {
  capturedAt: string
  durationDays: number | null
  price: number
  cycleMonths: number
  cycleDays: number | null
  platform: string
  note: string | null
}

export function readQuote(
  body: Record<string, unknown>,
  fallback: Cycle,
): QuoteInput {
  const capturedAt = date(body.capturedAt, '记录日期')
  return {
    capturedAt,
    durationDays: quoteDurationDays(body.durationDays),
    price: integer(body.price, '价格', 0, 1_000_000_000_000),
    ...parseCycle(body, fallback),
    platform: text(body.platform, '平台', 60),
    note: optionalText(body.note, 300),
  }
}

export function idParam(value: string, label: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `${label}不存在`)
  }
  return parsed
}

export type JointCostMode = 'split' | 'main'

export function costMode(value: unknown): JointCostMode {
  if (value === 'split' || value === 'main') return value
  throw new HttpError(400, '费用归属不正确')
}

export type JointMemberInput = {
  subscriptionId: number
  days: number
}

export function parseMembers(value: unknown, label: string): JointMemberInput[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, `${label}格式不正确`)
  }
  const seen = new Set<number>()
  const members: JointMemberInput[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new HttpError(400, `${label}格式不正确`)
    }
    const item = raw as Record<string, unknown>
    const subscriptionId = integer(item.subscriptionId, label, 1)
    if (seen.has(subscriptionId)) continue
    seen.add(subscriptionId)
    const days = integer(item.durationDays, `${label}时长（天）`, 1, 3650)
    members.push({ subscriptionId, days })
  }
  return members
}
