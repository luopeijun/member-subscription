import { describe, expect, it } from 'vitest'
import { formatDate, formatDay, monthLabel, statusLabel } from '@/utils/format'

describe('date formatting', () => {
  it('formats full dates', () => {
    expect(formatDate('2026-01-05')).toBe('2026年1月5日')
    expect(formatDate('2026-12-31')).toBe('2026年12月31日')
  })

  it('formats short dates', () => {
    expect(formatDay('2026-01-05')).toBe('1月5日')
    expect(formatDay('2026-12-31')).toBe('12月31日')
  })

  it('uses an em dash for missing dates', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate('')).toBe('—')
    expect(formatDay(null)).toBe('—')
    expect(formatDay('')).toBe('—')
  })

  it('formats month keys', () => {
    expect(monthLabel('2026-01')).toBe('1月')
    expect(monthLabel('2026-10')).toBe('10月')
  })
})

describe('statusLabel', () => {
  it('translates known statuses', () => {
    expect(statusLabel('active')).toBe('活跃')
    expect(statusLabel('planned')).toBe('想买')
    expect(statusLabel('expired')).toBe('已过期')
  })

  it('falls back to the raw value for unknown statuses', () => {
    expect(statusLabel('paused')).toBe('paused')
  })
})
