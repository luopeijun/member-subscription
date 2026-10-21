import { describe, expect, it } from 'vitest'
import {
  createQuoteDraft,
  quoteDurationDays,
  quoteDurationError,
  quoteDurationTerm,
  quoteMonthly,
  quotePayload,
  quotePriceMinor,
  validateQuoteDraft,
  type QuoteDraft,
} from '@/utils/quote'

function makeDraft(overrides: Partial<QuoteDraft> = {}): QuoteDraft {
  return {
    platform: '官网',
    price: '120',
    capturedAt: '2026-01-01',
    durationDays: '',
    cycleMonths: 12,
    cycleDays: null,
    ...overrides,
  }
}

describe('createQuoteDraft', () => {
  it('starts with an empty draft for the given cycle', () => {
    expect(createQuoteDraft('2026-01-01', 1, null)).toEqual({
      platform: '',
      price: '',
      capturedAt: '2026-01-01',
      durationDays: '',
      cycleMonths: 1,
      cycleDays: null,
    })
  })
})

describe('quotePriceMinor', () => {
  it('parses yuan prices into fen', () => {
    expect(quotePriceMinor(makeDraft({ price: '12.34' }))).toBe(1234)
    expect(quotePriceMinor(makeDraft({ price: '12.345' }))).toBe(1235)
    expect(quotePriceMinor(makeDraft({ price: '0' }))).toBe(0)
  })

  it('rejects empty, negative, or non-numeric prices', () => {
    expect(quotePriceMinor(makeDraft({ price: '' }))).toBeNull()
    expect(quotePriceMinor(makeDraft({ price: '   ' }))).toBeNull()
    expect(quotePriceMinor(makeDraft({ price: '-1' }))).toBeNull()
    expect(quotePriceMinor(makeDraft({ price: 'abc' }))).toBeNull()
  })
})

describe('quoteDurationDays', () => {
  it('accepts whole days within the allowed range', () => {
    expect(quoteDurationDays(makeDraft({ durationDays: '30' }))).toBe(30)
    expect(quoteDurationDays(makeDraft({ durationDays: ' 30 ' }))).toBe(30)
    expect(quoteDurationDays(makeDraft({ durationDays: '3650' }))).toBe(3650)
  })

  it('returns null for empty or invalid durations', () => {
    expect(quoteDurationDays(makeDraft({ durationDays: '' }))).toBeNull()
    expect(quoteDurationDays(makeDraft({ durationDays: '0' }))).toBeNull()
    expect(quoteDurationDays(makeDraft({ durationDays: '-1' }))).toBeNull()
    expect(quoteDurationDays(makeDraft({ durationDays: '1.5' }))).toBeNull()
    expect(quoteDurationDays(makeDraft({ durationDays: '3651' }))).toBeNull()
  })
})

describe('quoteDurationError', () => {
  it('returns no error for empty or valid durations', () => {
    expect(quoteDurationError(makeDraft({ durationDays: '' }))).toBeNull()
    expect(quoteDurationError(makeDraft({ durationDays: '30' }))).toBeNull()
  })

  it('explains invalid durations', () => {
    expect(quoteDurationError(makeDraft({ durationDays: 'abc' }))).toBe(
      '套餐总时长需要填写整数天数',
    )
    expect(quoteDurationError(makeDraft({ durationDays: '1.5' }))).toBe(
      '套餐总时长需要填写整数天数',
    )
    expect(quoteDurationError(makeDraft({ durationDays: '0' }))).toBe(
      '套餐总时长至少为 1 天',
    )
    expect(quoteDurationError(makeDraft({ durationDays: '3651' }))).toBe(
      '套餐总时长最多为 3650 天',
    )
  })
})

describe('quoteDurationTerm', () => {
  it('formats valid durations with the shared term formatter', () => {
    expect(quoteDurationTerm(makeDraft({ durationDays: '30' }))).toBe('30 天')
    expect(quoteDurationTerm(makeDraft({ durationDays: '60' }))).toBe('2 个月')
    expect(quoteDurationTerm(makeDraft({ durationDays: '365' }))).toBe('1 年')
  })

  it('returns null for an empty duration', () => {
    expect(quoteDurationTerm(makeDraft({ durationDays: '' }))).toBeNull()
  })
})

describe('quoteMonthly', () => {
  it('uses the entered duration when present', () => {
    expect(quoteMonthly(makeDraft({ price: '100', durationDays: '30' }))).toBe(10139)
    expect(quoteMonthly(makeDraft({ price: '365', durationDays: '365' }))).toBe(3042)
  })

  it('falls back to the billing cycle', () => {
    expect(quoteMonthly(makeDraft({ price: '120', cycleMonths: 12 }))).toBe(1000)
    expect(quoteMonthly(makeDraft({ price: '30', cycleMonths: 1 }))).toBe(3000)
  })

  it('returns null for invalid prices or one-time purchases', () => {
    expect(quoteMonthly(makeDraft({ price: '' }))).toBeNull()
    expect(quoteMonthly(makeDraft({ price: '100', cycleMonths: 0 }))).toBeNull()
  })
})

describe('validateQuoteDraft', () => {
  it('accepts a complete draft', () => {
    expect(validateQuoteDraft(makeDraft())).toBeNull()
  })

  it('requires a platform, price, and capture date', () => {
    expect(validateQuoteDraft(makeDraft({ platform: '' }))).toBe('请填写平台名称')
    expect(validateQuoteDraft(makeDraft({ platform: '   ' }))).toBe('请填写平台名称')
    expect(validateQuoteDraft(makeDraft({ price: '' }))).toBe('请填写价格')
    expect(validateQuoteDraft(makeDraft({ capturedAt: '' }))).toBe('请填写记录日期')
  })

  it('returns duration validation errors', () => {
    expect(validateQuoteDraft(makeDraft({ durationDays: '0' }))).toBe(
      '套餐总时长至少为 1 天',
    )
  })
})

describe('quotePayload', () => {
  it('trims the platform and converts prices to fen', () => {
    expect(
      quotePayload(
        makeDraft({
          platform: ' App Store ',
          price: '12.34',
          durationDays: '30',
        }),
        '备注',
      ),
    ).toEqual({
      platform: 'App Store',
      price: 1234,
      capturedAt: '2026-01-01',
      durationDays: 30,
      cycleMonths: 12,
      cycleDays: null,
      note: '备注',
    })
  })

  it('writes null when no total duration is entered', () => {
    expect(quotePayload(makeDraft({ durationDays: '' }), null)).toMatchObject({
      durationDays: null,
      note: null,
    })
  })
})
