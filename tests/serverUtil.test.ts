import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addDays,
  addMonths,
  daysBetween,
  formatISO,
  icsDate,
  icsStamp,
  isISODate,
  nowISO,
  pad2,
  parseISO,
} from '../server/util'

afterEach(() => {
  vi.useRealTimers()
})

describe('server date helpers', () => {
  it('pads numbers to two digits', () => {
    expect(pad2(1)).toBe('01')
    expect(pad2(12)).toBe('12')
  })

  it('round-trips ISO dates through UTC timestamps', () => {
    expect(parseISO('2026-01-02')).toBe(Date.UTC(2026, 0, 2))
    expect(formatISO(Date.UTC(2026, 0, 2))).toBe('2026-01-02')
    expect(formatISO(parseISO('2026-12-31'))).toBe('2026-12-31')
  })

  it('calculates day differences', () => {
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30)
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2)
    expect(daysBetween('2026-01-31', '2026-01-01')).toBe(-30)
  })

  it('adds months while clamping the day to the target month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15')
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
  })

  it('adds days across year boundaries', () => {
    expect(addDays('2026-01-01', 31)).toBe('2026-02-01')
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('validates ISO date shapes', () => {
    expect(isISODate('2026-01-02')).toBe(true)
    expect(isISODate('2026-1-2')).toBe(false)
    expect(isISODate('2026-01-02T00:00:00Z')).toBe(false)
    expect(isISODate(null)).toBe(false)
    expect(isISODate(20260102)).toBe(false)
  })

  it('formats dates for iCalendar', () => {
    expect(icsDate('2026-01-02')).toBe('20260102')
  })

  it('formats the current timestamp for iCalendar', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-05T12:34:56.789Z'))

    expect(nowISO()).toBe('2026-01-05T12:34:56.789Z')
    expect(icsStamp()).toBe('20260105T123456Z')
  })
})
