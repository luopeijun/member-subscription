import { describe, expect, it } from 'vitest'
import {
  monthlyEquivalent,
  sortSubscriptions,
  subscriptionMatchesQuery,
} from '@/utils/subscription'
import { makeSubscription } from './fixtures'

describe('monthlyEquivalent', () => {
  it('rounds the annualized cost to a monthly value', () => {
    expect(monthlyEquivalent(makeSubscription({ annualized: 12000 }))).toBe(1000)
    expect(monthlyEquivalent(makeSubscription({ annualized: 10000 }))).toBe(833)
  })

  it('requires a payment and a positive annualized cost', () => {
    expect(
      monthlyEquivalent(makeSubscription({ annualized: 12000, lastPayment: null })),
    ).toBeNull()
    expect(monthlyEquivalent(makeSubscription({ annualized: 0 }))).toBeNull()
  })
})

describe('subscriptionMatchesQuery', () => {
  const subscription = makeSubscription({
    serviceName: 'Netflix',
    planName: 'Premium',
    platform: 'App Store',
    account: 'family@example.com',
    note: '四人车',
  })

  it('matches across all searchable fields, case-insensitively', () => {
    expect(subscriptionMatchesQuery(subscription, 'netflix')).toBe(true)
    expect(subscriptionMatchesQuery(subscription, 'premium')).toBe(true)
    expect(subscriptionMatchesQuery(subscription, 'app store')).toBe(true)
    expect(subscriptionMatchesQuery(subscription, 'example')).toBe(true)
    expect(subscriptionMatchesQuery(subscription, '四人车')).toBe(true)
  })

  it('returns true for an empty query', () => {
    expect(subscriptionMatchesQuery(subscription, '')).toBe(true)
  })

  it('returns false when nothing matches', () => {
    expect(subscriptionMatchesQuery(subscription, 'spotify')).toBe(false)
  })

  it('ignores null optional fields', () => {
    const bare = makeSubscription({
      platform: null,
      account: null,
      note: null,
    })
    expect(subscriptionMatchesQuery(bare, 'app store')).toBe(false)
  })
})

describe('sortSubscriptions', () => {
  it('orders active, planned, then expired', () => {
    const items = [
      makeSubscription({ id: 3, status: 'expired', serviceName: 'C' }),
      makeSubscription({ id: 1, status: 'active', serviceName: 'A' }),
      makeSubscription({ id: 2, status: 'planned', serviceName: 'B' }),
    ]
    expect(items.sort(sortSubscriptions).map((item) => item.id)).toEqual([1, 2, 3])
  })

  it('orders the same status by next renewal date', () => {
    const items = [
      makeSubscription({ id: 2, nextRenewalAt: '2026-03-01' }),
      makeSubscription({ id: 1, nextRenewalAt: '2026-02-01' }),
    ]
    expect(items.sort(sortSubscriptions).map((item) => item.id)).toEqual([1, 2])
  })

  it('puts items without a next renewal date last', () => {
    const items = [
      makeSubscription({ id: 1, nextRenewalAt: null }),
      makeSubscription({ id: 2, nextRenewalAt: '2026-06-01' }),
      makeSubscription({ id: 3, nextRenewalAt: '2026-02-01' }),
    ]
    expect(items.sort(sortSubscriptions).map((item) => item.id)).toEqual([3, 2, 1])
  })

  it('falls back to service name when renewal dates are equal or absent', () => {
    const items = [
      makeSubscription({ id: 1, serviceName: 'Beta', nextRenewalAt: null }),
      makeSubscription({ id: 2, serviceName: 'Alpha', nextRenewalAt: null }),
    ]
    expect(items.sort(sortSubscriptions).map((item) => item.id)).toEqual([2, 1])
  })

  it('sorts unknown statuses after known statuses', () => {
    const items = [
      makeSubscription({ id: 1, status: 'paused', serviceName: 'A' }),
      makeSubscription({ id: 2, status: 'expired', serviceName: 'B' }),
      makeSubscription({ id: 3, status: 'active', serviceName: 'C' }),
    ]
    expect(items.sort(sortSubscriptions).map((item) => item.id)).toEqual([3, 2, 1])
  })
})
