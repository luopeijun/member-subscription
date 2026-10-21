import { describe, expect, it } from 'vitest'
import {
  DAYS_PER_MONTH,
  DAYS_PER_YEAR,
  MAX_DURATION_DAYS,
  addDaysISO,
  daysBetweenISO,
  formatDuration,
} from '@shared/duration'
import { clampDurationDays } from '@/utils/duration'

describe('shared duration', () => {
  it('uses 365 days as a 12-month year', () => {
    expect(DAYS_PER_YEAR).toBe(365)
    expect(DAYS_PER_MONTH).toBe(365 / 12)
    expect(MAX_DURATION_DAYS).toBe(3650)
  })

  it('formats durations and falls back for empty values', () => {
    expect(formatDuration(1)).toBe('1 天')
    expect(formatDuration(365)).toBe('365 天')
    expect(formatDuration(0)).toBe('未设置')
    expect(formatDuration(-1)).toBe('未设置')
  })

  it('adds days on UTC dates, including leap years and year boundaries', () => {
    expect(addDaysISO('2026-01-01', 31)).toBe('2026-02-01')
    expect(addDaysISO('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDaysISO('2025-12-31', 1)).toBe('2026-01-01')
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('calculates calendar day differences on UTC dates', () => {
    expect(daysBetweenISO('2026-01-01', '2026-01-31')).toBe(30)
    expect(daysBetweenISO('2024-02-28', '2024-03-01')).toBe(2)
    expect(daysBetweenISO('2026-01-31', '2026-01-01')).toBe(-30)
    expect(daysBetweenISO('2026-01-01', '2026-01-01')).toBe(0)
  })
})

describe('clampDurationDays', () => {
  it('keeps integer day counts within the allowed range', () => {
    expect(clampDurationDays('30')).toBe(30)
    expect(clampDurationDays('30.9')).toBe(30)
    expect(clampDurationDays('3650')).toBe(3650)
  })

  it('falls back to one day for empty or invalid input', () => {
    expect(clampDurationDays('')).toBe(1)
    expect(clampDurationDays('abc')).toBe(1)
    expect(clampDurationDays('0')).toBe(1)
    expect(clampDurationDays('-5')).toBe(1)
  })

  it('caps values above the maximum duration', () => {
    expect(clampDurationDays('3651')).toBe(3650)
    expect(clampDurationDays('99999')).toBe(3650)
  })
})
