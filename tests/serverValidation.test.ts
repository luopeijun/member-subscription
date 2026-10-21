import { describe, expect, it } from 'vitest'
import { HttpError } from '../server/errors'
import {
  costMode,
  cycle,
  cycleDays,
  date,
  idParam,
  integer,
  maybeDate,
  optionalText,
  parseCycle,
  parseMembers,
  quoteDurationDays,
  readQuote,
  status,
  text,
} from '../server/validation'

const yearly = { cycleMonths: 12, cycleDays: null }

function captureHttpError(fn: () => unknown): HttpError {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError)
    return error as HttpError
  }
  throw new Error('Expected HttpError to be thrown')
}

function expectHttpError(
  fn: () => unknown,
  statusCode: number,
  message: string,
): void {
  const error = captureHttpError(fn)
  expect(error.status).toBe(statusCode)
  expect(error.message).toBe(message)
}

describe('text validation', () => {
  it('trims required text and applies the maximum length', () => {
    expect(text('  官网  ', '平台')).toBe('官网')
    expect(text('abcdef', '名称', 3)).toBe('abc')
  })

  it('rejects empty or non-string values', () => {
    expectHttpError(() => text('', '平台'), 400, '请填写平台')
    expectHttpError(() => text('   ', '平台'), 400, '请填写平台')
    expectHttpError(() => text(123, '平台'), 400, '请填写平台')
  })
})

describe('optionalText validation', () => {
  it('returns null for empty or non-string values', () => {
    expect(optionalText(undefined)).toBeNull()
    expect(optionalText(null)).toBeNull()
    expect(optionalText(123)).toBeNull()
    expect(optionalText('   ')).toBeNull()
  })

  it('trims and limits optional text', () => {
    expect(optionalText('  备注  ')).toBe('备注')
    expect(optionalText('abcdef', 3)).toBe('abc')
  })
})

describe('integer validation', () => {
  it('accepts numbers and numeric strings', () => {
    expect(integer('42', '数量')).toBe(42)
    expect(integer(42, '数量')).toBe(42)
    expect(integer('0', '数量', 0)).toBe(0)
  })

  it('rejects non-integer or non-finite values', () => {
    expectHttpError(() => integer('1.5', '数量'), 400, '数量必须是整数')
    expectHttpError(() => integer('abc', '数量'), 400, '数量必须是整数')
    expectHttpError(() => integer(Infinity, '数量'), 400, '数量必须是整数')
  })

  it('enforces the allowed range', () => {
    expectHttpError(() => integer('11', '数量', 0, 10), 400, '数量超出允许范围')
    expectHttpError(() => integer('-1', '数量', 0, 10), 400, '数量超出允许范围')
  })
})

describe('date validation', () => {
  it('accepts valid ISO calendar dates', () => {
    expect(date('2026-01-02', '日期')).toBe('2026-01-02')
    expect(date('2024-02-29', '日期')).toBe('2024-02-29')
  })

  it('rejects malformed or impossible dates', () => {
    expectHttpError(
      () => date('2026-2-3', '日期'),
      400,
      '日期格式应为 YYYY-MM-DD',
    )
    expectHttpError(() => date(null, '日期'), 400, '日期格式应为 YYYY-MM-DD')
    expectHttpError(() => date('2026-02-30', '日期'), 400, '日期不是有效日期')
    expectHttpError(() => date('2025-02-29', '日期'), 400, '日期不是有效日期')
  })

  it('treats empty optional dates as null', () => {
    expect(maybeDate(null, '日期')).toBeNull()
    expect(maybeDate(undefined, '日期')).toBeNull()
    expect(maybeDate('', '日期')).toBeNull()
    expect(maybeDate('2026-01-02', '日期')).toBe('2026-01-02')
  })
})

describe('status validation', () => {
  it('accepts the three supported statuses', () => {
    expect(status('active')).toBe('active')
    expect(status('planned')).toBe('planned')
    expect(status('expired')).toBe('expired')
  })

  it('rejects unknown statuses', () => {
    expectHttpError(() => status('paused'), 400, '状态不正确')
    expectHttpError(() => status(undefined), 400, '状态不正确')
  })
})

describe('cycle validation', () => {
  it('accepts supported billing cycles', () => {
    for (const months of [-1, 0, 1, 3, 6, 12, 24]) {
      expect(cycle(months)).toBe(months)
    }
  })

  it('rejects unsupported or out-of-range cycles', () => {
    expectHttpError(
      () => cycle(2),
      400,
      '计费周期只能是 1 天、1 周、月付、季付、半年付、年付、2 年、一次性付费或买断',
    )
    expectHttpError(() => cycle(121), 400, '周期超出允许范围')
    expectHttpError(() => cycle(-2), 400, '周期超出允许范围')
    expectHttpError(() => cycle('1.5'), 400, '周期必须是整数')
  })

  it('validates cycle days', () => {
    expect(cycleDays(null)).toBeNull()
    expect(cycleDays(undefined)).toBeNull()
    expect(cycleDays('')).toBeNull()
    expect(cycleDays('7')).toBe(7)
    expect(cycleDays(3650)).toBe(3650)
    expectHttpError(() => cycleDays(0), 400, '周期天数超出允许范围')
    expectHttpError(() => cycleDays(3651), 400, '周期天数超出允许范围')
    expectHttpError(() => cycleDays(1.5), 400, '周期天数必须是整数')
  })

  it('validates quote duration days', () => {
    expect(quoteDurationDays('')).toBeNull()
    expect(quoteDurationDays('30')).toBe(30)
    expect(quoteDurationDays(3650)).toBe(3650)
    expectHttpError(
      () => quoteDurationDays(0),
      400,
      '套餐总时长（天）超出允许范围',
    )
    expectHttpError(
      () => quoteDurationDays(3651),
      400,
      '套餐总时长（天）超出允许范围',
    )
    expectHttpError(
      () => quoteDurationDays(1.5),
      400,
      '套餐总时长（天）必须是整数',
    )
  })
})

describe('parseCycle', () => {
  it('prefers explicit cycle days', () => {
    expect(parseCycle({ cycleDays: 7, cycleMonths: 12 }, yearly)).toEqual({
      cycleMonths: 0,
      cycleDays: 7,
    })
    expect(parseCycle({ cycleDays: '30' }, yearly)).toEqual({
      cycleMonths: 0,
      cycleDays: 30,
    })
  })

  it('falls back to an explicit month cycle', () => {
    expect(
      parseCycle({ cycleDays: null, cycleMonths: 3 }, yearly),
    ).toEqual({ cycleMonths: 3, cycleDays: null })
    expect(
      parseCycle({ cycleDays: '', cycleMonths: 6 }, yearly),
    ).toEqual({ cycleMonths: 6, cycleDays: null })
    expect(parseCycle({ cycleMonths: 24 }, yearly)).toEqual({
      cycleMonths: 24,
      cycleDays: null,
    })
  })

  it('uses the fallback when the body has no cycle', () => {
    expect(parseCycle({}, yearly)).toEqual(yearly)
    expect(
      parseCycle({}, { cycleMonths: 0, cycleDays: 14 }),
    ).toEqual({ cycleMonths: 0, cycleDays: 14 })
  })

  it('validates explicit and fallback cycle values', () => {
    expectHttpError(() => parseCycle({ cycleDays: 0 }, yearly), 400, '周期天数超出允许范围')
    expectHttpError(
      () => parseCycle({ cycleMonths: 2 }, yearly),
      400,
      '计费周期只能是 1 天、1 周、月付、季付、半年付、年付、2 年、一次性付费或买断',
    )
    expectHttpError(
      () => parseCycle({}, { cycleMonths: 2, cycleDays: null }),
      400,
      '计费周期只能是 1 天、1 周、月付、季付、半年付、年付、2 年、一次性付费或买断',
    )
  })
})

describe('readQuote', () => {
  it('normalizes a complete quote', () => {
    expect(
      readQuote(
        {
          capturedAt: '2026-01-02',
          price: 12000,
          platform: ' 官网 ',
          durationDays: 365,
          cycleDays: null,
          cycleMonths: 12,
          note: '  活动价  ',
        },
        yearly,
      ),
    ).toEqual({
      capturedAt: '2026-01-02',
      durationDays: 365,
      price: 12000,
      cycleMonths: 12,
      cycleDays: null,
      platform: '官网',
      note: '活动价',
    })
  })

  it('prefers day cycles and accepts free quotes', () => {
    expect(
      readQuote(
        {
          capturedAt: '2026-01-02',
          price: 0,
          platform: 'App Store',
          durationDays: '',
          cycleDays: 30,
          cycleMonths: 12,
        },
        yearly,
      ),
    ).toMatchObject({
      durationDays: null,
      price: 0,
      cycleMonths: 0,
      cycleDays: 30,
      note: null,
    })
  })

  it('validates required quote fields', () => {
    expectHttpError(
      () => readQuote({ price: 100, platform: '官网' }, yearly),
      400,
      '记录日期格式应为 YYYY-MM-DD',
    )
    expectHttpError(
      () => readQuote({ capturedAt: '2026-01-02', platform: '官网' }, yearly),
      400,
      '价格必须是整数',
    )
    expectHttpError(
      () => readQuote({ capturedAt: '2026-01-02', price: 100 }, yearly),
      400,
      '请填写平台',
    )
  })
})

describe('idParam', () => {
  it('accepts positive integer IDs', () => {
    expect(idParam('1', '会员记录')).toBe(1)
    expect(idParam('42', '会员记录')).toBe(42)
  })

  it('rejects invalid IDs', () => {
    for (const value of ['0', '-1', '1.5', 'abc']) {
      expectHttpError(() => idParam(value, '会员记录'), 400, '会员记录不存在')
    }
  })
})

describe('costMode', () => {
  it('accepts split and main modes', () => {
    expect(costMode('split')).toBe('split')
    expect(costMode('main')).toBe('main')
  })

  it('rejects unknown modes', () => {
    expectHttpError(() => costMode('other'), 400, '费用归属不正确')
  })
})

describe('parseMembers', () => {
  it('normalizes member IDs and durations', () => {
    expect(
      parseMembers(
        [
          { subscriptionId: 1, durationDays: 30 },
          { subscriptionId: '2', durationDays: '365' },
        ],
        '参与会员',
      ),
    ).toEqual([
      { subscriptionId: 1, days: 30 },
      { subscriptionId: 2, days: 365 },
    ])
  })

  it('keeps the first entry for duplicate members', () => {
    expect(
      parseMembers(
        [
          { subscriptionId: 1, durationDays: 30 },
          { subscriptionId: 1, durationDays: 60 },
        ],
        '参与会员',
      ),
    ).toEqual([{ subscriptionId: 1, days: 30 }])
  })

  it('rejects non-array or malformed members', () => {
    expectHttpError(() => parseMembers(null, '参与会员'), 400, '参与会员格式不正确')
    expectHttpError(() => parseMembers({}, '参与会员'), 400, '参与会员格式不正确')
    expectHttpError(() => parseMembers([null], '参与会员'), 400, '参与会员格式不正确')
    expectHttpError(() => parseMembers(['x'], '参与会员'), 400, '参与会员格式不正确')
  })

  it('validates member IDs and durations', () => {
    expectHttpError(
      () => parseMembers([{ durationDays: 30 }], '参与会员'),
      400,
      '参与会员必须是整数',
    )
    expectHttpError(
      () => parseMembers([{ subscriptionId: 0, durationDays: 30 }], '参与会员'),
      400,
      '参与会员超出允许范围',
    )
    expectHttpError(
      () => parseMembers([{ subscriptionId: 1 }], '参与会员'),
      400,
      '参与会员时长（天）必须是整数',
    )
    expectHttpError(
      () => parseMembers([{ subscriptionId: 1, durationDays: 0 }], '参与会员'),
      400,
      '参与会员时长（天）超出允许范围',
    )
    expectHttpError(
      () => parseMembers([{ subscriptionId: 1, durationDays: 3651 }], '参与会员'),
      400,
      '参与会员时长（天）超出允许范围',
    )
  })
})
