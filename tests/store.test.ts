import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

type Database = (typeof import('../server/db'))['db']
type BuildState = (typeof import('../server/store'))['buildState']

let tempDir: string
let db: Database
let buildState: BuildState

const CREATED_AT = '2026-01-01T00:00:00.000Z'

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'subledger-store-'))
  process.env.SUBLEDGER_DB_PATH = path.join(tempDir, 'test.db')

  const dbModule = await import('../server/db')
  const storeModule = await import('../server/store')
  db = dbModule.db
  buildState = storeModule.buildState
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 21, 12, 0, 0))
  db.exec(`
    DELETE FROM joint_quote_items;
    DELETE FROM joint_quotes;
    DELETE FROM payments;
    DELETE FROM joint_renewals;
    DELETE FROM price_snapshots;
    DELETE FROM subscriptions;
    DELETE FROM plans;
    DELETE FROM services;
  `)
})

afterEach(() => {
  vi.useRealTimers()
})

afterAll(() => {
  db.close()
  fs.rmSync(tempDir, { recursive: true, force: true })
  delete process.env.SUBLEDGER_DB_PATH
})

function insertService(name: string, category = '其他'): number {
  const info = db
    .prepare(
      'INSERT INTO services (name, category, created_at) VALUES (?, ?, ?)',
    )
    .run(name, category, CREATED_AT)
  return Number(info.lastInsertRowid)
}

function insertPlan(
  serviceId: number,
  overrides: {
    name?: string
    cycleMonths?: number
    cycleDays?: number | null
    listPrice?: number
    note?: string | null
  } = {},
): number {
  const {
    name = '标准版',
    cycleMonths = 1,
    cycleDays = null,
    listPrice = 1000,
    note = null,
  } = overrides
  const info = db
    .prepare(
      `INSERT INTO plans
        (service_id, name, cycle_months, cycle_days, list_price, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(serviceId, name, cycleMonths, cycleDays, listPrice, note, CREATED_AT)
  return Number(info.lastInsertRowid)
}

function insertSubscription(
  planId: number,
  overrides: {
    platform?: string | null
    account?: string | null
    startedAt?: string
    nextRenewalOverride?: string | null
    autoRenew?: boolean
    status?: string
    note?: string | null
  } = {},
): number {
  const {
    platform = null,
    account = null,
    startedAt = '2026-01-01',
    nextRenewalOverride = null,
    autoRenew = true,
    status = 'active',
    note = null,
  } = overrides
  const info = db
    .prepare(
      `INSERT INTO subscriptions
        (plan_id, platform, account, started_at, next_renewal_override,
         auto_renew, status, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      planId,
      platform,
      account,
      startedAt,
      nextRenewalOverride,
      autoRenew ? 1 : 0,
      status,
      note,
      CREATED_AT,
    )
  return Number(info.lastInsertRowid)
}

function insertPayment(
  subscriptionId: number,
  overrides: {
    paidAt?: string
    amount?: number
    durationDays?: number | null
    jointRenewalId?: number | null
    note?: string | null
  } = {},
): number {
  const {
    paidAt = '2026-10-01',
    amount = 1000,
    durationDays = null,
    jointRenewalId = null,
    note = null,
  } = overrides
  const info = db
    .prepare(
      `INSERT INTO payments
        (subscription_id, paid_at, amount, note, joint_renewal_id, duration_days, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      subscriptionId,
      paidAt,
      amount,
      note,
      jointRenewalId,
      durationDays,
      CREATED_AT,
    )
  return Number(info.lastInsertRowid)
}

function insertJointQuote(input: {
  capturedAt?: string
  total: number
  cycleMonths?: number
  mainSubscriptionId?: number | null
  costMode?: 'split' | 'main'
  platform?: string | null
  note?: string | null
  items: { subscriptionId: number; durationDays: number }[]
}): number {
  const {
    capturedAt = '2026-10-01',
    total,
    cycleMonths = 12,
    mainSubscriptionId = null,
    costMode = 'split',
    platform = null,
    note = null,
    items,
  } = input
  const info = db
    .prepare(
      `INSERT INTO joint_quotes
        (captured_at, total, cycle_months, main_subscription_id, cost_mode,
         platform, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      capturedAt,
      total,
      cycleMonths,
      mainSubscriptionId,
      costMode,
      platform,
      note,
      CREATED_AT,
    )
  const quoteId = Number(info.lastInsertRowid)
  const insertItem = db.prepare(
    `INSERT INTO joint_quote_items
      (joint_quote_id, subscription_id, duration_days)
     VALUES (?, ?, ?)`,
  )
  for (const item of items) {
    insertItem.run(quoteId, item.subscriptionId, item.durationDays)
  }
  return quoteId
}

describe('buildState', () => {
  it('builds an active subscription and its dashboard stats', () => {
    const serviceId = insertService('Netflix', '影音娱乐')
    const planId = insertPlan(serviceId, { cycleMonths: 1, listPrice: 1000 })
    const subscriptionId = insertSubscription(planId, {
      startedAt: '2026-09-01',
    })
    insertPayment(subscriptionId, { paidAt: '2026-10-01', amount: 1000 })

    const state = buildState()
    const subscription = state.subscriptions.find(
      (item) => item.id === subscriptionId,
    )

    expect(state.today).toBe('2026-10-21')
    expect(subscription).toMatchObject({
      status: 'active',
      nextRenewalAt: '2026-11-01',
      daysLeft: 11,
      annualized: 12000,
      totalSpent: 1000,
      paymentCount: 1,
      priceChangePct: null,
      lastPayment: {
        paidAt: '2026-10-01',
        amount: 1000,
      },
    })
    expect(state.plans[0]).toMatchObject({
      id: planId,
      subscribed: true,
    })
    expect(state.stats).toMatchObject({
      activeCount: 1,
      annualized: 12000,
      monthly: 1000,
      totalSpent: 1000,
      upcoming30: 1,
      expiredCount: 0,
      categories: [{ category: '影音娱乐', annualized: 12000, count: 1 }],
      upcoming: [
        {
          subscriptionId,
          serviceName: 'Netflix',
          planName: '标准版',
          date: '2026-11-01',
          daysLeft: 11,
          amount: 1000,
          platform: null,
          autoRenew: true,
        },
      ],
    })
    expect(state.stats.monthlySpend).toHaveLength(12)
    expect(
      state.stats.monthlySpend.find((item) => item.month === '2026-10'),
    ).toEqual({ month: '2026-10', total: 1000 })
  })

  it('keeps planned subscriptions out of spending and renewals', () => {
    const serviceId = insertService('Spotify', '影音娱乐')
    const planId = insertPlan(serviceId, { cycleMonths: 1 })
    const subscriptionId = insertSubscription(planId, {
      status: 'planned',
      startedAt: '2026-09-01',
    })

    const state = buildState()
    const subscription = state.subscriptions.find(
      (item) => item.id === subscriptionId,
    )

    expect(subscription).toMatchObject({
      status: 'planned',
      nextRenewalAt: null,
      daysLeft: null,
      annualized: 0,
      totalSpent: 0,
    })
    expect(state.stats).toMatchObject({
      activeCount: 0,
      annualized: 0,
      totalSpent: 0,
      upcoming30: 0,
      expiredCount: 0,
      upcoming: [],
    })
    expect(state.plans[0].subscribed).toBe(false)
  })

  it('marks a subscription expired when its computed renewal date has passed', () => {
    const serviceId = insertService('Notion', '软件工具')
    const planId = insertPlan(serviceId, { cycleMonths: 1 })
    const subscriptionId = insertSubscription(planId, {
      startedAt: '2026-01-01',
    })

    const state = buildState()
    const subscription = state.subscriptions.find(
      (item) => item.id === subscriptionId,
    )

    expect(subscription).toMatchObject({
      status: 'expired',
      nextRenewalAt: '2026-02-01',
      daysLeft: -262,
      annualized: 0,
    })
    expect(state.stats.expiredCount).toBe(1)
    expect(state.stats.activeCount).toBe(0)
    expect(state.stats.upcoming).toEqual([])
  })

  it('uses a manual renewal date override', () => {
    const serviceId = insertService('YouTube', '影音娱乐')
    const planId = insertPlan(serviceId, { cycleMonths: 1 })
    const subscriptionId = insertSubscription(planId, {
      nextRenewalOverride: '2026-11-15',
    })
    insertPayment(subscriptionId, { paidAt: '2026-10-01', amount: 1000 })

    const subscription = buildState().subscriptions.find(
      (item) => item.id === subscriptionId,
    )

    expect(subscription).toMatchObject({
      status: 'active',
      nextRenewalAt: '2026-11-15',
      daysLeft: 25,
    })
  })

  it('annualizes by the payment duration when a joint renewal grants a different term', () => {
    const serviceId = insertService('iCloud', '云存储')
    const planId = insertPlan(serviceId, {
      cycleMonths: 12,
      listPrice: 12000,
    })
    const subscriptionId = insertSubscription(planId)
    insertPayment(subscriptionId, {
      paidAt: '2026-10-01',
      amount: 12000,
      durationDays: 30,
    })

    const subscription = buildState().subscriptions.find(
      (item) => item.id === subscriptionId,
    )

    expect(subscription).toMatchObject({
      annualized: 146000,
      totalSpent: 12000,
    })
  })

  it('compares the last two payments and totals all spending', () => {
    const serviceId = insertService('Adobe', '软件工具')
    const planId = insertPlan(serviceId, { cycleMonths: 1 })
    const subscriptionId = insertSubscription(planId)
    insertPayment(subscriptionId, { paidAt: '2026-08-01', amount: 1000 })
    insertPayment(subscriptionId, { paidAt: '2026-10-01', amount: 1200 })

    const state = buildState()
    const subscription = state.subscriptions.find(
      (item) => item.id === subscriptionId,
    )

    expect(subscription).toMatchObject({
      annualized: 14400,
      totalSpent: 2200,
      paymentCount: 2,
      priceChangePct: 0.2,
      lastPayment: { paidAt: '2026-10-01', amount: 1200 },
      prevPayment: { paidAt: '2026-08-01', amount: 1000 },
    })
    expect(
      state.stats.monthlySpend.find((item) => item.month === '2026-08'),
    ).toEqual({ month: '2026-08', total: 1000 })
    expect(
      state.stats.monthlySpend.find((item) => item.month === '2026-10'),
    ).toEqual({ month: '2026-10', total: 1200 })
  })

  it('builds upcoming renewals within 90 days and counts the 30-day window', () => {
    const serviceId = insertService('Bilibili', '影音娱乐')
    const planId = insertPlan(serviceId, { cycleMonths: 1 })
    const first = insertSubscription(planId, {
      nextRenewalOverride: '2026-11-10',
    })
    const second = insertSubscription(planId, {
      nextRenewalOverride: '2026-12-20',
    })
    const third = insertSubscription(planId, {
      nextRenewalOverride: '2027-02-01',
    })
    insertPayment(first, { paidAt: '2026-10-01', amount: 1000 })
    insertPayment(second, { paidAt: '2026-10-01', amount: 2000 })
    insertPayment(third, { paidAt: '2026-10-01', amount: 3000 })

    const state = buildState()

    expect(state.stats.upcoming.map((item) => item.subscriptionId)).toEqual([
      first,
      second,
    ])
    expect(state.stats.upcoming.map((item) => item.daysLeft)).toEqual([20, 60])
    expect(state.stats.upcoming30).toBe(1)
  })

  it('limits monthly spending to the last 12 months but keeps lifetime totals', () => {
    const serviceId = insertService('Steam', '游戏')
    const planId = insertPlan(serviceId, { cycleMonths: 1 })
    const subscriptionId = insertSubscription(planId)
    insertPayment(subscriptionId, { paidAt: '2024-01-01', amount: 500 })
    insertPayment(subscriptionId, { paidAt: '2026-10-01', amount: 1000 })

    const state = buildState()

    expect(state.stats.totalSpent).toBe(1500)
    expect(
      state.stats.monthlySpend.reduce((sum, item) => sum + item.total, 0),
    ).toBe(1000)
    expect(state.stats.monthlySpend[0].month).toBe('2025-11')
    expect(state.stats.monthlySpend.at(-1)?.month).toBe('2026-10')
  })

  it('aggregates categories by annualized cost', () => {
    const videoService = insertService('Netflix', '影音娱乐')
    const videoPlan = insertPlan(videoService, { cycleMonths: 1 })
    const videoSub = insertSubscription(videoPlan)
    insertPayment(videoSub, { paidAt: '2026-10-01', amount: 1000 })

    const softwareService = insertService('Adobe', '软件工具')
    const softwarePlan = insertPlan(softwareService, { cycleMonths: 1 })
    const softwareSub = insertSubscription(softwarePlan)
    insertPayment(softwareSub, { paidAt: '2026-10-01', amount: 2000 })

    expect(buildState().stats.categories).toEqual([
      { category: '软件工具', annualized: 24000, count: 1 },
      { category: '影音娱乐', annualized: 12000, count: 1 },
    ])
  })

  it('builds joint quote items with allocated amounts and monthly comparisons', () => {
    const firstService = insertService('Netflix', '影音娱乐')
    const firstPlan = insertPlan(firstService, { cycleMonths: 12 })
    const first = insertSubscription(firstPlan)
    insertPayment(first, { paidAt: '2026-10-01', amount: 12000 })

    const secondService = insertService('Spotify', '影音娱乐')
    const secondPlan = insertPlan(secondService, { cycleMonths: 1 })
    const second = insertSubscription(secondPlan)
    insertPayment(second, { paidAt: '2026-10-01', amount: 1000 })

    insertJointQuote({
      total: 12000,
      cycleMonths: 12,
      mainSubscriptionId: first,
      items: [
        { subscriptionId: first, durationDays: 365 },
        { subscriptionId: second, durationDays: 365 },
      ],
    })

    const quote = buildState().jointQuotes[0]

    expect(quote).toMatchObject({
      total: 12000,
      mainSubscriptionId: first,
      costMode: 'split',
    })
    expect(quote.items.map((item) => item.amount)).toEqual([6000, 6000])
    expect(quote.items.map((item) => item.monthly)).toEqual([1000, 1000])
  })
})
