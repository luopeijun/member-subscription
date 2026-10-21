import { describe, expect, it } from 'vitest'
import {
  CYCLE_OPTIONS,
  cycleKey,
  cycleLabel,
  cycleMonthly,
  cycleOptions,
  readCycle,
} from '@/utils/cycle'

describe('cycle key', () => {
  it('uses days when a day cycle is present', () => {
    expect(cycleKey(0, 7)).toBe('day:7')
    expect(cycleKey(12, 7)).toBe('day:7')
  })

  it('uses months otherwise', () => {
    expect(cycleKey(1, null)).toBe('month:1')
    expect(cycleKey(-1, null)).toBe('month:-1')
    expect(cycleKey(0, 0)).toBe('month:0')
  })
})

describe('readCycle', () => {
  it('reads known options', () => {
    expect(readCycle('month:12')).toEqual({ cycleMonths: 12, cycleDays: null })
    expect(readCycle('day:7')).toEqual({ cycleMonths: 0, cycleDays: 7 })
    expect(readCycle('month:0')).toEqual({ cycleMonths: 0, cycleDays: null })
    expect(readCycle('month:-1')).toEqual({ cycleMonths: -1, cycleDays: null })
  })

  it('reads custom valid values', () => {
    expect(readCycle('day:14')).toEqual({ cycleMonths: 0, cycleDays: 14 })
    expect(readCycle('month:5')).toEqual({ cycleMonths: 5, cycleDays: null })
  })

  it('falls back to yearly billing for invalid values', () => {
    expect(readCycle('day:0')).toEqual({ cycleMonths: 12, cycleDays: null })
    expect(readCycle('day:1.5')).toEqual({ cycleMonths: 12, cycleDays: null })
    expect(readCycle('month:abc')).toEqual({ cycleMonths: 12, cycleDays: null })
    expect(readCycle('unknown:12')).toEqual({ cycleMonths: 12, cycleDays: null })
    expect(readCycle('')).toEqual({ cycleMonths: 12, cycleDays: null })
  })
})

describe('cycleOptions', () => {
  it('returns the shared options for known cycles', () => {
    expect(cycleOptions(1, null)).toBe(CYCLE_OPTIONS)
    expect(cycleOptions(0, 7)).toBe(CYCLE_OPTIONS)
  })

  it('appends a custom day option', () => {
    const options = cycleOptions(0, 14)
    expect(options).toHaveLength(CYCLE_OPTIONS.length + 1)
    expect(options.at(-1)).toEqual({
      key: 'day:14',
      label: '14 天',
      cycleMonths: 0,
      cycleDays: 14,
    })
  })

  it('appends a custom month option', () => {
    const options = cycleOptions(5, null)
    expect(options.at(-1)).toEqual({
      key: 'month:5',
      label: '5 个月',
      cycleMonths: 5,
      cycleDays: null,
    })
  })
})

describe('cycleMonthly', () => {
  it('splits monthly and yearly amounts', () => {
    expect(cycleMonthly(1, null, 1000)).toBe(1000)
    expect(cycleMonthly(12, null, 12000)).toBe(1000)
    expect(cycleMonthly(3, null, 3000)).toBe(1000)
  })

  it('converts day cycles using the 365 / 12 month length', () => {
    expect(cycleMonthly(0, 30, 3000)).toBe(3042)
    expect(cycleMonthly(0, 1, 100)).toBe(3042)
    expect(cycleMonthly(0, 7, 700)).toBe(3042)
  })

  it('returns null when no recurring cycle exists', () => {
    expect(cycleMonthly(0, null, 1000)).toBeNull()
    expect(cycleMonthly(0, 0, 1000)).toBeNull()
    expect(cycleMonthly(-1, null, 1000)).toBeNull()
  })
})

describe('cycleLabel', () => {
  it('labels day cycles', () => {
    expect(cycleLabel(0, 1)).toBe('1 天')
    expect(cycleLabel(0, 7)).toBe('1 周')
    expect(cycleLabel(0, 14)).toBe('14 天')
  })

  it('labels common month cycles', () => {
    expect(cycleLabel(1)).toBe('月付')
    expect(cycleLabel(3)).toBe('季付')
    expect(cycleLabel(6)).toBe('半年付')
    expect(cycleLabel(12)).toBe('年付')
    expect(cycleLabel(24)).toBe('2 年')
    expect(cycleLabel(5)).toBe('5 个月')
  })

  it('labels non-recurring cycles', () => {
    expect(cycleLabel(0)).toBe('一次性付费')
    expect(cycleLabel(-1)).toBe('买断')
  })
})
