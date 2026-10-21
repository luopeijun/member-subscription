import { describe, expect, it } from 'vitest'
import { buildMemberJointQuoteEntries } from '@/utils/jointQuote'
import { makeJointQuote, makeJointQuoteItem } from './fixtures'

function quote(id: number, capturedAt: string, items: ReturnType<typeof makeJointQuoteItem>[]) {
  return makeJointQuote({ id, capturedAt, items })
}

describe('buildMemberJointQuoteEntries', () => {
  it('expands quotes per member and calculates allocated monthly cost and savings', () => {
    const jointQuote = quote(1, '2026-01-01', [
      makeJointQuoteItem({
        subscriptionId: 1,
        serviceName: '服务 A',
        planName: '年付',
        durationDays: 365,
        amount: 12000,
        monthly: 1000,
      }),
      makeJointQuoteItem({
        subscriptionId: 2,
        serviceName: '服务 B',
        planName: '年付',
        durationDays: 365,
        amount: 6000,
        monthly: 800,
      }),
    ])

    const entries = buildMemberJointQuoteEntries([jointQuote])

    expect(entries.get(1)?.[0]).toMatchObject({
      allocatedMonthly: 1000,
      diff: 0,
    })
    expect(entries.get(1)?.[0].companions).toEqual([
      { subscriptionId: 2, serviceName: '服务 B', planName: '年付' },
    ])
    expect(entries.get(2)?.[0]).toMatchObject({
      allocatedMonthly: 500,
      diff: -300,
    })
    expect(entries.get(2)?.[0].companions).toEqual([
      { subscriptionId: 1, serviceName: '服务 A', planName: '年付' },
    ])
  })

  it('rounds allocated monthly costs and sorts by savings', () => {
    const first = quote(1, '2026-01-01', [
      makeJointQuoteItem({
        subscriptionId: 1,
        durationDays: 365,
        amount: 12000,
        monthly: 1000,
      }),
    ])
    const second = quote(2, '2026-02-01', [
      makeJointQuoteItem({
        subscriptionId: 1,
        durationDays: 180,
        amount: 6000,
        monthly: 1200,
      }),
    ])

    const entries = buildMemberJointQuoteEntries([first, second]).get(1)

    expect(entries?.map((entry) => entry.quote.id)).toEqual([2, 1])
    expect(entries?.[0]).toMatchObject({
      allocatedMonthly: 1014,
      diff: -186,
    })
  })

  it('sorts entries without a saving difference last', () => {
    const priced = quote(1, '2026-01-01', [
      makeJointQuoteItem({
        subscriptionId: 1,
        durationDays: 365,
        amount: 12000,
        monthly: 1000,
      }),
    ])
    const missingDuration = quote(2, '2026-02-01', [
      makeJointQuoteItem({
        subscriptionId: 1,
        durationDays: 0,
        amount: 12000,
        monthly: 1000,
      }),
    ])

    const entries = buildMemberJointQuoteEntries([missingDuration, priced]).get(1)

    expect(entries?.map((entry) => entry.quote.id)).toEqual([1, 2])
    expect(entries?.[1]).toMatchObject({ allocatedMonthly: null, diff: null })
  })

  it('treats a missing comparison monthly cost as no difference', () => {
    const jointQuote = quote(1, '2026-01-01', [
      makeJointQuoteItem({
        subscriptionId: 1,
        durationDays: 365,
        amount: 12000,
        monthly: null,
      }),
    ])

    expect(buildMemberJointQuoteEntries([jointQuote]).get(1)?.[0]).toMatchObject({
      allocatedMonthly: 1000,
      diff: null,
    })
  })

  it('orders equal differences by capture date and quote id descending', () => {
    const older = quote(1, '2026-01-01', [
      makeJointQuoteItem({ subscriptionId: 1, durationDays: 365, amount: 12000, monthly: 1000 }),
    ])
    const newer = quote(2, '2026-02-01', [
      makeJointQuoteItem({ subscriptionId: 1, durationDays: 365, amount: 12000, monthly: 1000 }),
    ])
    const newest = quote(3, '2026-02-01', [
      makeJointQuoteItem({ subscriptionId: 1, durationDays: 365, amount: 12000, monthly: 1000 }),
    ])

    expect(
      buildMemberJointQuoteEntries([older, newer, newest])
        .get(1)
        ?.map((entry) => entry.quote.id),
    ).toEqual([3, 2, 1])
  })

  it('returns an empty map when there are no joint quotes', () => {
    expect(buildMemberJointQuoteEntries([]).size).toBe(0)
  })
})
