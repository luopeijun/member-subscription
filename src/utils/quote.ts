import { DAYS_PER_MONTH, daysBetweenISO } from '@shared/duration'
import { toMinor } from '@shared/money'
import { formatTermDays } from '@/utils/snapshot'

export type QuoteDraft = {
  platform: string
  price: string
  capturedAt: string
  expiresAt: string
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
    expiresAt: '',
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

export function quoteExpiryDays(draft: QuoteDraft): number | null {
  if (!draft.capturedAt || !draft.expiresAt) return null
  const days = daysBetweenISO(draft.capturedAt, draft.expiresAt)
  return days > 0 ? days : null
}

export function quoteExpiryTerm(draft: QuoteDraft): string | null {
  const days = quoteExpiryDays(draft)
  return days === null ? null : formatTermDays(days)
}

export function quoteExpiryMonthly(draft: QuoteDraft): number | null {
  const days = quoteExpiryDays(draft)
  const price = quotePriceMinor(draft)
  if (days === null || price === null) return null
  return Math.round((price * DAYS_PER_MONTH) / days)
}

export function validateQuoteDraft(draft: QuoteDraft): string | null {
  if (!draft.platform.trim()) return '请填写平台名称'
  if (quotePriceMinor(draft) === null) return '请填写价格'
  if (!draft.capturedAt) return '请填写记录日期'
  if (draft.expiresAt && !quoteExpiryDays(draft)) {
    return '到期日需要晚于记录日期'
  }
  return null
}

export function quotePayload(draft: QuoteDraft, note: string | null) {
  return {
    platform: draft.platform.trim(),
    price: toMinor(Number(draft.price)),
    capturedAt: draft.capturedAt,
    expiresAt: draft.expiresAt || null,
    cycleMonths: draft.cycleMonths,
    cycleDays: draft.cycleDays,
    note,
  }
}
