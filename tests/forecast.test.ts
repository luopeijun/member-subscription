import { describe, expect, it } from 'vitest'
import { buildRenewalForecast } from '@/utils/forecast'
import { makeSubscription } from './fixtures'

function totals(forecast: { month: string; total: number }[]) {
  return Object.fromEntries(forecast.map((item) => [item.month, item.total]))
}

function paid(amount: number, paidAt = '2026-01-01') {
  return { id: 1, paidAt, amount }
}

describe('buildRenewalForecast', () => {
  it('returns zero-filled months for the requested range', () => {
    expect(buildRenewalForecast([], '2026-01-15', 3)).toEqual([
      { month: '2026-01', total: 0 },
      { month: '2026-02', total: 0 },
      { month: '2026-03', total: 0 },
    ])
  })

  it('returns no months for a zero count', () => {
    expect(buildRenewalForecast([], '2026-01-15', 0)).toEqual([])
  })

  it('spreads monthly renewals across the range', () => {
    const subscription = makeSubscription({
      nextRenewalAt: '2026-01-15',
      lastPayment: paid(1000),
      cycleMonths: 1,
      cycleDays: null,
    })

    const forecast = buildRenewalForecast([subscription], '2026-01-15', 3)

    expect(totals(forecast)).toEqual({
      '2026-01': 1000,
      '2026-02': 1000,
      '2026-03': 1000,
    })
  })

  it('includes a renewal due today', () => {
    const subscription = makeSubscription({
      nextRenewalAt: '2026-01-15',
      lastPayment: paid(1000),
      cycleMonths: 1,
    })

    expect(buildRenewalForecast([subscription], '2026-01-15', 1)).toEqual([
      { month: '2026-01', total: 1000 },
    ])
  })

  it('ignores a renewal date before today', () => {
    const subscription = makeSubscription({
      nextRenewalAt: '2026-01-14',
      lastPayment: paid(1000),
      cycleMonths: 1,
    })

    expect(buildRenewalForecast([subscription], '2026-01-15', 2)).toEqual([
      { month: '2026-01', total: 0 },
      { month: '2026-02', total: 0 },
    ])
  })

  it('keeps yearly renewals in their renewal month', () => {
    const subscription = makeSubscription({
      nextRenewalAt: '2026-03-01',
      lastPayment: paid(12000),
      cycleMonths: 12,
      cycleDays: null,
    })

    const forecast = buildRenewalForecast([subscription], '2026-01-01', 12)

    expect(totals(forecast)['2026-03']).toBe(12000)
    expect(forecast.reduce((sum, item) => sum + item.total, 0)).toBe(12000)
  })

  it('includes another yearly renewal when the range crosses a year', () => {
    const subscription = makeSubscription({
      nextRenewalAt: '2026-03-01',
      lastPayment: paid(12000),
      cycleMonths: 12,
    })

    const forecast = buildRenewalForecast([subscription], '2026-01-01', 15)

    expect(totals(forecast)['2026-03']).toBe(12000)
    expect(totals(forecast)['2027-03']).toBe(12000)
  })

  it('adds one-time purchases only once', () => {
    const subscription = makeSubscription({
      nextRenewalAt: '2026-02-01',
      lastPayment: paid(5000),
      cycleMonths: 0,
      cycleDays: null,
    })

    const forecast = buildRenewalForecast([subscription], '2026-01-01', 4)

    expect(totals(forecast)).toEqual({
      '2026-01': 0,
      '2026-02': 5000,
      '2026-03': 0,
      '2026-04': 0,
    })
  })

  it('supports day-based billing cycles', () => {
    const subscription = makeSubscription({
      nextRenewalAt: '2026-01-01',
      lastPayment: paid(3000),
      cycleMonths: 0,
      cycleDays: 30,
    })

    const forecast = buildRenewalForecast([subscription], '2026-01-01', 3)

    expect(totals(forecast)).toEqual({
      '2026-01': 6000,
      '2026-02': 0,
      '2026-03': 3000,
    })
  })

  it('only forecasts active subscriptions', () => {
    const planned = makeSubscription({
      id: 1,
      status: 'planned',
      nextRenewalAt: '2026-01-15',
      lastPayment: paid(1000),
    })
    const expired = makeSubscription({
      id: 2,
      status: 'expired',
      nextRenewalAt: '2026-01-15',
      lastPayment: paid(1000),
    })

    const forecast = buildRenewalForecast([planned, expired], '2026-01-01', 2)

    expect(forecast.every((item) => item.total === 0)).toBe(true)
  })

  it('skips incomplete or non-positive payment data', () => {
    const missingPayment = makeSubscription({
      id: 1,
      nextRenewalAt: '2026-01-15',
      lastPayment: null,
    })
    const missingRenewal = makeSubscription({
      id: 2,
      nextRenewalAt: null,
      lastPayment: paid(1000),
    })
    const free = makeSubscription({
      id: 3,
      nextRenewalAt: '2026-01-15',
      lastPayment: paid(0),
    })

    const forecast = buildRenewalForecast(
      [missingPayment, missingRenewal, free],
      '2026-01-01',
      2,
    )

    expect(forecast.every((item) => item.total === 0)).toBe(true)
  })

  it('aggregates subscriptions in the same month', () => {
    const first = makeSubscription({
      id: 1,
      nextRenewalAt: '2026-01-10',
      lastPayment: paid(1000),
      cycleMonths: 1,
    })
    const second = makeSubscription({
      id: 2,
      nextRenewalAt: '2026-01-20',
      lastPayment: paid(2500),
      cycleMonths: 1,
    })

    const forecast = buildRenewalForecast([first, second], '2026-01-01', 1)

    expect(forecast).toEqual([{ month: '2026-01', total: 3500 }])
  })

  it('builds month keys across a year boundary', () => {
    const forecast = buildRenewalForecast([], '2025-11-20', 4)
    expect(forecast.map((item) => item.month)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ])
  })

  it('ignores renewals after the forecast range', () => {
    const subscription = makeSubscription({
      nextRenewalAt: '2026-04-01',
      lastPayment: paid(1000),
      cycleMonths: 1,
    })

    const forecast = buildRenewalForecast([subscription], '2026-01-01', 3)

    expect(forecast.every((item) => item.total === 0)).toBe(true)
  })
})
