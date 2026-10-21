import { describe, expect, it } from 'vitest'
import {
  formatTermDays,
  latestPerPlatform,
  snapshotDurationLabel,
  snapshotMonthly,
} from '@/utils/snapshot'
import { makeSnapshot } from './fixtures'

describe('snapshotMonthly', () => {
  it('uses the entered duration when present', () => {
    expect(snapshotMonthly({ price: 12000, durationDays: 365, cycleMonths: 12, cycleDays: null })).toBe(
      1000,
    )
    expect(snapshotMonthly({ price: 3000, durationDays: 30, cycleMonths: 1, cycleDays: null })).toBe(
      3042,
    )
  })

  it('falls back to the billing cycle when duration is missing or zero', () => {
    expect(
      snapshotMonthly({ price: 12000, durationDays: null, cycleMonths: 12, cycleDays: null }),
    ).toBe(1000)
    expect(
      snapshotMonthly({ price: 700, durationDays: 0, cycleMonths: 0, cycleDays: 7 }),
    ).toBe(3042)
  })

  it('returns null for one-time purchases without a duration', () => {
    expect(
      snapshotMonthly({ price: 1000, durationDays: null, cycleMonths: 0, cycleDays: null }),
    ).toBeNull()
  })
})

describe('formatTermDays', () => {
  it('uses days below two months', () => {
    expect(formatTermDays(1)).toBe('1 天')
    expect(formatTermDays(30)).toBe('30 天')
    expect(formatTermDays(59)).toBe('59 天')
  })

  it('uses months from two months upward', () => {
    expect(formatTermDays(60)).toBe('2 个月')
    expect(formatTermDays(90)).toBe('3 个月')
  })

  it('uses years for long terms', () => {
    expect(formatTermDays(365)).toBe('1 年')
    expect(formatTermDays(395)).toBe('1 年 1 个月')
    expect(formatTermDays(730)).toBe('2 年')
    expect(formatTermDays(760)).toBe('2 年 1 个月')
  })

  it('shows a dash for non-positive values', () => {
    expect(formatTermDays(0)).toBe('—')
    expect(formatTermDays(-1)).toBe('—')
  })
})

describe('snapshotDurationLabel', () => {
  it('prefers the entered duration', () => {
    expect(
      snapshotDurationLabel({ durationDays: 30, cycleMonths: 12, cycleDays: null }),
    ).toBe('30 天')
  })

  it('falls back to the billing cycle label', () => {
    expect(
      snapshotDurationLabel({ durationDays: null, cycleMonths: 1, cycleDays: null }),
    ).toBe('月付')
    expect(
      snapshotDurationLabel({ durationDays: 0, cycleMonths: 12, cycleDays: null }),
    ).toBe('年付')
  })
})

describe('latestPerPlatform', () => {
  it('keeps the first snapshot for each normalized platform and sorts by price', () => {
    const snapshots = [
      makeSnapshot({ id: 1, planId: 1, platform: 'App Store', price: 1200 }),
      makeSnapshot({ id: 2, planId: 1, platform: ' app store ', price: 1000 }),
      makeSnapshot({ id: 3, planId: 1, platform: null, price: 800 }),
      makeSnapshot({ id: 4, planId: 2, platform: 'App Store', price: 500 }),
    ]

    expect(latestPerPlatform(snapshots, 1).map((snapshot) => snapshot.id)).toEqual([3, 1])
  })

  it('returns an empty list when the plan has no snapshots', () => {
    expect(latestPerPlatform([], 1)).toEqual([])
    expect(latestPerPlatform([makeSnapshot({ planId: 2 })], 1)).toEqual([])
  })
})
