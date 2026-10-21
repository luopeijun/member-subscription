import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { HttpError } from '../server/errors'

type Database = (typeof import('../server/db'))['db']
type ExportAll = (typeof import('../server/transfer'))['exportAll']
type ImportAll = (typeof import('../server/transfer'))['importAll']

type ExportData = {
  app: string
  version: number
  exportedAt: string
  services: {
    id: number
    name: string
    category: string
    created_at: string
  }[]
  plans: {
    id: number
    service_id: number
    name: string
    cycle_months: number
    cycle_days: number | null
    list_price: number
    note: string | null
    created_at: string
  }[]
  subscriptions: {
    id: number
    plan_id: number
    auto_renew: number
    status: string
    note: string | null
  }[]
  payments: {
    id: number
    subscription_id: number
    joint_renewal_id: number | null
  }[]
  jointRenewals: {
    id: number
    main_subscription_id: number | null
    cost_mode: string
    note: string | null
  }[]
  snapshots: {
    id: number
    plan_id: number
    duration_days: number | null
    price: number
    cycle_months: number
    cycle_days: number | null
    platform: string | null
  }[]
  jointQuotes: {
    id: number
    total: number
    main_subscription_id: number | null
    cost_mode: string
    platform: string | null
    items: { subscription_id: number; duration_days: number | null }[]
  }[]
}

let tempDir: string
let db: Database
let exportAll: ExportAll
let importAll: ImportAll

const CREATED_AT = '2026-01-01T00:00:00.000Z'

function readExport(): ExportData {
  return exportAll() as unknown as ExportData
}

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'subledger-transfer-'))
  process.env.SUBLEDGER_DB_PATH = path.join(tempDir, 'test.db')

  const dbModule = await import('../server/db')
  const transferModule = await import('../server/transfer')
  db = dbModule.db
  exportAll = transferModule.exportAll
  importAll = transferModule.importAll
})

beforeEach(() => {
  clearAll()
})

afterAll(() => {
  db.close()
  fs.rmSync(tempDir, { recursive: true, force: true })
  delete process.env.SUBLEDGER_DB_PATH
})

function clearAll(): void {
  db.exec(`
    DELETE FROM joint_quote_items;
    DELETE FROM joint_quotes;
    DELETE FROM payments;
    DELETE FROM joint_renewals;
    DELETE FROM price_snapshots;
    DELETE FROM subscriptions;
    DELETE FROM plans;
    DELETE FROM services;
    DELETE FROM sqlite_sequence;
  `)
}

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

function insertSnapshot(
  planId: number,
  overrides: {
    capturedAt?: string
    durationDays?: number | null
    price?: number
    cycleMonths?: number
    cycleDays?: number | null
    platform?: string | null
    note?: string | null
  } = {},
): number {
  const {
    capturedAt = '2026-10-01',
    durationDays = 365,
    price = 12000,
    cycleMonths = 12,
    cycleDays = null,
    platform = '官网',
    note = null,
  } = overrides
  const info = db
    .prepare(
      `INSERT INTO price_snapshots
        (plan_id, captured_at, duration_days, price, cycle_months, cycle_days,
         platform, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      planId,
      capturedAt,
      durationDays,
      price,
      cycleMonths,
      cycleDays,
      platform,
      note,
      CREATED_AT,
    )
  return Number(info.lastInsertRowid)
}

function insertJointRenewal(
  input: {
    mainSubscriptionId?: number | null
    paidAt?: string
    total?: number
    cycleMonths?: number
    costMode?: 'split' | 'main'
    note?: string | null
  } = {},
): number {
  const {
    mainSubscriptionId = null,
    paidAt = '2026-10-01',
    total = 12000,
    cycleMonths = 12,
    costMode = 'split',
    note = null,
  } = input
  const info = db
    .prepare(
      `INSERT INTO joint_renewals
        (main_subscription_id, paid_at, total, cycle_months, cost_mode, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      mainSubscriptionId,
      paidAt,
      total,
      cycleMonths,
      costMode,
      note,
      CREATED_AT,
    )
  return Number(info.lastInsertRowid)
}

function insertJointQuote(input: {
  capturedAt?: string
  total?: number
  cycleMonths?: number
  mainSubscriptionId?: number | null
  costMode?: 'split' | 'main'
  platform?: string | null
  note?: string | null
  items: { subscriptionId: number; durationDays: number }[]
}): number {
  const {
    capturedAt = '2026-10-02',
    total = 12000,
    cycleMonths = 12,
    mainSubscriptionId = null,
    costMode = 'split',
    platform = '拼车群',
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

function seedFullDataset() {
  const netflixService = insertService('Netflix', '影音娱乐')
  const spotifyService = insertService('Spotify', '影音娱乐')
  const netflixPlan = insertPlan(netflixService, {
    name: 'Premium',
    cycleMonths: 1,
    listPrice: 1500,
  })
  const spotifyPlan = insertPlan(spotifyService, {
    name: 'Family',
    cycleMonths: 12,
    listPrice: 12000,
  })
  const netflix = insertSubscription(netflixPlan, {
    platform: '官网',
    account: 'family@example.com',
    startedAt: '2026-01-01',
    nextRenewalOverride: '2026-11-01',
    autoRenew: false,
    status: 'planned',
    note: '主账号',
  })
  const spotify = insertSubscription(spotifyPlan, {
    platform: 'App Store',
    startedAt: '2026-02-01',
    autoRenew: true,
    status: 'active',
    note: null,
  })
  const renewal = insertJointRenewal({
    mainSubscriptionId: netflix,
    paidAt: '2026-10-01',
    total: 12000,
    cycleMonths: 12,
    costMode: 'main',
    note: '联合续费',
  })
  insertPayment(netflix, {
    paidAt: '2026-10-01',
    amount: 6000,
    durationDays: 365,
    jointRenewalId: renewal,
    note: '分摊',
  })
  insertPayment(spotify, {
    paidAt: '2026-10-01',
    amount: 6000,
    durationDays: 365,
    jointRenewalId: renewal,
  })
  insertSnapshot(netflixPlan, {
    capturedAt: '2026-10-01',
    durationDays: 365,
    price: 12000,
    cycleMonths: 12,
    platform: '官网',
    note: '年付报价',
  })
  insertJointQuote({
    capturedAt: '2026-10-02',
    total: 12000,
    cycleMonths: 12,
    mainSubscriptionId: spotify,
    costMode: 'split',
    platform: '拼车群',
    note: '联合报价',
    items: [
      { subscriptionId: netflix, durationDays: 365 },
      { subscriptionId: spotify, durationDays: 365 },
    ],
  })

  return { netflix, spotify, netflixPlan, spotifyPlan }
}

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

describe('exportAll', () => {
  it('exports every table and keeps joint quote items attached', () => {
    const ids = seedFullDataset()
    const data = readExport()

    expect(data.app).toBe('subledger')
    expect(data.version).toBe(1)
    expect(data.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(data.services).toEqual([
      { id: 1, name: 'Netflix', category: '影音娱乐', created_at: CREATED_AT },
      { id: 2, name: 'Spotify', category: '影音娱乐', created_at: CREATED_AT },
    ])
    expect(data.plans).toEqual([
      {
        id: 1,
        service_id: 1,
        name: 'Premium',
        cycle_months: 1,
        cycle_days: null,
        list_price: 1500,
        note: null,
        created_at: CREATED_AT,
      },
      {
        id: 2,
        service_id: 2,
        name: 'Family',
        cycle_months: 12,
        cycle_days: null,
        list_price: 12000,
        note: null,
        created_at: CREATED_AT,
      },
    ])
    expect(data.subscriptions).toHaveLength(2)
    expect(data.subscriptions[0]).toMatchObject({
      id: ids.netflix,
      plan_id: ids.netflixPlan,
      auto_renew: 0,
      status: 'planned',
    })
    expect(data.payments).toHaveLength(2)
    expect(data.payments[0]).toMatchObject({
      subscription_id: ids.netflix,
      amount: 6000,
      duration_days: 365,
      joint_renewal_id: 1,
    })
    expect(data.jointRenewals).toEqual([
      {
        id: 1,
        main_subscription_id: ids.netflix,
        paid_at: '2026-10-01',
        total: 12000,
        cycle_months: 12,
        cost_mode: 'main',
        note: '联合续费',
        created_at: CREATED_AT,
      },
    ])
    expect(data.snapshots[0]).toMatchObject({
      plan_id: ids.netflixPlan,
      duration_days: 365,
      price: 12000,
      cycle_months: 12,
      platform: '官网',
    })
    expect(data.jointQuotes[0]).toMatchObject({
      id: 1,
      total: 12000,
      main_subscription_id: ids.spotify,
      cost_mode: 'split',
      platform: '拼车群',
      items: [
        { subscription_id: ids.netflix, duration_days: 365 },
        { subscription_id: ids.spotify, duration_days: 365 },
      ],
    })
  })

  it('exports empty arrays for an empty database', () => {
    expect(exportAll()).toMatchObject({
      app: 'subledger',
      version: 1,
      services: [],
      plans: [],
      subscriptions: [],
      jointRenewals: [],
      payments: [],
      snapshots: [],
      jointQuotes: [],
    })
  })
})

describe('importAll', () => {
  it('round-trips a full export through import', () => {
    seedFullDataset()
    const before = readExport()

    clearAll()
    const summary = importAll(before)
    const after = readExport()

    expect(summary).toEqual({
      servicesAdded: 2,
      plansAdded: 2,
      subscriptionsAdded: 2,
      jointRenewalsAdded: 1,
      jointQuotesAdded: 1,
      paymentsAdded: 2,
      snapshotsAdded: 1,
    })
    expect({ ...after, exportedAt: '' }).toEqual({
      ...before,
      exportedAt: '',
    })
  })

  it('merges existing services and plans but appends subscriptions', () => {
    const existingService = insertService('Netflix', '旧分类')
    const existingPlan = insertPlan(existingService, {
      name: 'Premium',
      cycleMonths: 1,
      listPrice: 1000,
    })

    const summary = importAll({
      app: 'subledger',
      services: [
        {
          id: 10,
          name: ' netflix ',
          category: '新分类',
          created_at: CREATED_AT,
        },
      ],
      plans: [
        {
          id: 20,
          service_id: 10,
          name: 'premium',
          cycle_months: 1,
          cycle_days: null,
          list_price: 2000,
          created_at: CREATED_AT,
        },
      ],
      subscriptions: [
        {
          id: 30,
          plan_id: 20,
          started_at: '2026-01-01',
          created_at: CREATED_AT,
        },
      ],
    })

    const data = readExport()

    expect(summary).toMatchObject({
      servicesAdded: 0,
      plansAdded: 0,
      subscriptionsAdded: 1,
    })
    expect(data.services).toHaveLength(1)
    expect(data.services[0].category).toBe('旧分类')
    expect(data.plans).toHaveLength(1)
    expect(data.plans[0]).toMatchObject({
      id: existingPlan,
      list_price: 1000,
    })
    expect(data.subscriptions[0].plan_id).toBe(existingPlan)
  })

  it('deduplicates services and plans within the same payload', () => {
    const summary = importAll({
      services: [
        { id: 1, name: 'Netflix', category: '影音娱乐', created_at: CREATED_AT },
        { id: 2, name: 'netflix', category: '其他', created_at: CREATED_AT },
      ],
      plans: [
        {
          id: 1,
          service_id: 1,
          name: 'Premium',
          cycle_months: 1,
          cycle_days: null,
          list_price: 1000,
          created_at: CREATED_AT,
        },
        {
          id: 2,
          service_id: 2,
          name: 'premium',
          cycle_months: 1,
          cycle_days: null,
          list_price: 1000,
          created_at: CREATED_AT,
        },
      ],
      subscriptions: [
        {
          id: 1,
          plan_id: 1,
          started_at: '2026-01-01',
          created_at: CREATED_AT,
        },
        {
          id: 2,
          plan_id: 2,
          started_at: '2026-01-01',
          created_at: CREATED_AT,
        },
      ],
    })

    const data = readExport()

    expect(summary).toMatchObject({
      servicesAdded: 1,
      plansAdded: 1,
      subscriptionsAdded: 2,
    })
    expect(data.services).toHaveLength(1)
    expect(data.plans).toHaveLength(1)
    expect(data.subscriptions).toHaveLength(2)
    expect(data.subscriptions[0].plan_id).toBe(data.plans[0].id)
    expect(data.subscriptions[1].plan_id).toBe(data.plans[0].id)
  })

  it('imports legacy fields and normalizes statuses and cycles', () => {
    const summary = importAll({
      services: [
        { id: 1, name: 'Legacy', category: '', created_at: CREATED_AT },
      ],
      plans: [
        {
          id: 1,
          service_id: 1,
          name: 'Legacy Plan',
          cycle_months: 2,
          cycle_days: null,
          list_price: 1000,
          created_at: CREATED_AT,
        },
      ],
      subscriptions: [
        {
          id: 1,
          plan_id: 1,
          started_at: '2026-01-01',
          status: 'paused',
          auto_renew: '1',
          shared_with: '合租',
          note: '备注',
          created_at: CREATED_AT,
        },
      ],
      snapshots: [
        {
          id: 1,
          plan_id: 1,
          captured_at: '2026-01-01',
          price: 12000,
          expires_at: '2026-12-31',
          cycle_months: 12,
          cycle_days: null,
          created_at: CREATED_AT,
        },
      ],
    })

    const data = readExport()

    expect(summary).toMatchObject({
      servicesAdded: 1,
      plansAdded: 1,
      subscriptionsAdded: 1,
      snapshotsAdded: 1,
    })
    expect(data.services[0].category).toBe('其他')
    expect(data.plans[0].cycle_months).toBe(12)
    expect(data.subscriptions[0]).toMatchObject({
      status: 'expired',
      auto_renew: 1,
      note: '备注 · 合租',
    })
    expect(data.snapshots[0]).toMatchObject({
      duration_days: 364,
      cycle_months: 12,
      cycle_days: null,
    })
  })

  it('imports snake_case joint records and falls back to the first quote member', () => {
    const summary = importAll({
      services: [
        { id: 1, name: 'Legacy', category: '其他', created_at: CREATED_AT },
      ],
      plans: [
        {
          id: 1,
          service_id: 1,
          name: 'Plan',
          cycle_months: 1,
          cycle_days: null,
          list_price: 1000,
          created_at: CREATED_AT,
        },
      ],
      subscriptions: [
        {
          id: 1,
          plan_id: 1,
          started_at: '2026-01-01',
          created_at: CREATED_AT,
        },
      ],
      joint_renewals: [
        {
          id: 1,
          main_subscription_id: 1,
          paid_at: '2026-10-01',
          total: 1000,
          cycle_months: 12,
          cost_mode: 'main',
          note: '旧联合续费',
          created_at: CREATED_AT,
        },
      ],
      payments: [
        {
          subscription_id: 1,
          paid_at: '2026-10-01',
          amount: 1000,
          joint_renewal_id: 1,
          duration_days: 365,
          created_at: CREATED_AT,
        },
      ],
      joint_quotes: [
        {
          id: 1,
          captured_at: '2026-10-02',
          total: 1000,
          cycle_months: 12,
          main_subscription_id: 999,
          cost_mode: 'split',
          platform: '拼车群',
          items: [
            { subscription_id: 1, duration_days: 365 },
            { subscription_id: 1, duration_days: 365 },
            { subscription_id: 999, duration_days: 365 },
          ],
          created_at: CREATED_AT,
        },
      ],
    })

    const data = readExport()

    expect(summary).toMatchObject({
      jointRenewalsAdded: 1,
      jointQuotesAdded: 1,
      paymentsAdded: 1,
    })
    expect(data.jointRenewals[0]).toMatchObject({
      main_subscription_id: data.subscriptions[0].id,
      cost_mode: 'main',
      note: '旧联合续费',
    })
    expect(data.payments[0].joint_renewal_id).toBe(data.jointRenewals[0].id)
    expect(data.jointQuotes[0]).toMatchObject({
      main_subscription_id: data.subscriptions[0].id,
      items: [{ subscription_id: data.subscriptions[0].id, duration_days: 365 }],
    })
  })

  it('accepts an empty payload and returns zero counts', () => {
    expect(importAll({})).toEqual({
      servicesAdded: 0,
      plansAdded: 0,
      subscriptionsAdded: 0,
      jointRenewalsAdded: 0,
      jointQuotesAdded: 0,
      paymentsAdded: 0,
      snapshotsAdded: 0,
    })
  })

  it('rejects invalid payloads and rolls back partial imports', () => {
    expectHttpError(() => importAll(null), 400, '导入文件内容为空')
    expectHttpError(() => importAll('invalid'), 400, '导入文件内容为空')
    expectHttpError(
      () => importAll({ app: 'other' }),
      400,
      '这不是会员订阅的备份文件',
    )
    expectHttpError(
      () => importAll({ services: {} }),
      400,
      '服务列表 格式不正确',
    )

    expectHttpError(
      () =>
        importAll({
          services: [
            { id: 1, name: 'Broken', created_at: CREATED_AT },
          ],
          plans: [
            {
              id: 1,
              service_id: 999,
              name: 'Broken Plan',
              cycle_months: 1,
              cycle_days: null,
              list_price: 1000,
              created_at: CREATED_AT,
            },
          ],
        }),
      400,
      '套餐引用了不存在的服务',
    )
    expect(readExport().services).toEqual([])

    expectHttpError(
      () =>
        importAll({
          payments: [
            {
              subscription_id: 1,
              paid_at: '2026-10-01',
              amount: 1000,
            },
          ],
        }),
      400,
      '支付记录引用了不存在的会员',
    )
    expectHttpError(
      () =>
        importAll({
          snapshots: [
            {
              plan_id: 1,
              captured_at: '2026-10-01',
              price: 1000,
            },
          ],
        }),
      400,
      '报价引用了不存在的套餐',
    )
  })
})
