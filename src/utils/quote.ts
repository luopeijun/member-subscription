import { DAYS_PER_MONTH, MAX_DURATION_DAYS } from '@shared/duration'
import { toMinor } from '@shared/money'
import { cycleMonthly } from '@/utils/cycle'
import { formatTermDays } from '@/utils/snapshot'

export type QuoteDraft = {
  platform: string
  price: string
  capturedAt: string
  durationDays: string
  cycleMonths: number
  cycleDays: number | null
}

export function createQuoteDraft(
  today: string,
  cycleMonths: number,
  cycleDays: number | null,
): QuoteDraft {
  return {
    platform: '',
    price: '',
    capturedAt: today,
    durationDays: '',
    cycleMonths,
    cycleDays,
  }
}

export function quotePriceMinor(draft: QuoteDraft): number | null {
  const value = Number(draft.price)
  if (draft.price.trim() === '' || !Number.isFinite(value) || value < 0) {
    return null
  }
  return toMinor(value)
}

/** 报价包含的总时长；未填写时按计费周期折算。 */
export function quoteDurationDays(draft: QuoteDraft): number | null {
  const raw = draft.durationDays.trim()
  if (!raw) return null
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1 || value > MAX_DURATION_DAYS) {
    return null
  }
  return value
}

export function quoteDurationError(draft: QuoteDraft): string | null {
  const raw = draft.durationDays.trim()
  if (!raw) return null
  const value = Number(raw)
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return '套餐总时长需要填写整数天数'
  }
  if (value < 1) {
    return '套餐总时长至少为 1 天'
  }
  if (value > MAX_DURATION_DAYS) {
    return `套餐总时长最多为 ${MAX_DURATION_DAYS} 天`
  }
  return null
}

export function quoteDurationTerm(draft: QuoteDraft): string | null {
  const days = quoteDurationDays(draft)
  return days === null ? null : formatTermDays(days)
}

export function quoteMonthly(draft: QuoteDraft): number | null {
  const price = quotePriceMinor(draft)
  if (price === null) return null
  const days = quoteDurationDays(draft)
  if (days !== null) {
    return Math.round((price * DAYS_PER_MONTH) / days)
  }
  return cycleMonthly(draft.cycleMonths, draft.cycleDays, price)
}

export function validateQuoteDraft(draft: QuoteDraft): string | null {
  if (!draft.platform.trim()) return '请填写平台名称'
  if (quotePriceMinor(draft) === null) return '请填写价格'
  if (!draft.capturedAt) return '请填写记录日期'
  return quoteDurationError(draft)
}

export function quotePayload(draft: QuoteDraft, note: string | null) {
  return {
    platform: draft.platform.trim(),
    price: toMinor(Number(draft.price)),
    capturedAt: draft.capturedAt,
    durationDays: quoteDurationDays(draft),
    cycleMonths: draft.cycleMonths,
    cycleDays: draft.cycleDays,
    note,
  }
}
