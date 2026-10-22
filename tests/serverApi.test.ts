import fs from 'node:fs'
import type { Server } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { addDays, addMonths, todayISO } from '../server/util'
import type { AppState } from '../server/store'

type Subscription = AppState['subscriptions'][number]
type ImportResponse = AppState & { imported: Record<string, number> }

let tempDir: string
let baseUrl: string
let server: Server
let stopServer: typeof import('../server/app').stopServer

const today = todayISO()

async function request<T>(url: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${url}`, init)
  const body = (await response.json()) as T
  return { response, body }
}

function jsonRequest<T>(method: string, url: string, body: unknown) {
  return request<T>(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function findSubscription(state: AppState, serviceName: string): Subscription {
  const subscription = state.subscriptions.find(
    (item) => item.serviceName === serviceName,
  )
  if (!subscription) throw new Error(`未找到会员：${serviceName}`)
  return subscription
}

async function createSubscription(
  overrides: Record<string, unknown> = {},
): Promise<AppState> {
  const { response, body } = await jsonRequest<AppState>(
    'POST',
    '/api/subscriptions',
    {
      serviceName: '测试服务',
      category: '工具',
      planName: '年付',
      cycleMonths: 12,
      listPrice: 19800,
      startedAt: today,
      ...overrides,
    },
  )
  expect(response.status).toBe(201)
  return body
}

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'subledger-api-'))
  process.env.SUBLEDGER_DB_PATH = path.join(tempDir, 'api.db')
  const staticDir = path.join(tempDir, 'dist')
  fs.mkdirSync(staticDir)
  fs.writeFileSync(
    path.join(staticDir, 'index.html'),
    '<!doctype html><html><body><div id="root"></div></body></html>',
  )

  const appModule = await import('../server/app')
  stopServer = appModule.stopServer
  const started = await appModule.startServer({ staticDir })
  server = started.server
  baseUrl = `http://${started.host}:${started.port}`
})

beforeEach(async () => {
  const { response } = await jsonRequest<AppState>('DELETE', '/api/data', {
    confirm: 'DELETE',
  })
  expect(response.status).toBe(200)
})

afterAll(async () => {
  if (server) await stopServer(server)
  fs.rmSync(tempDir, { recursive: true, force: true })
  delete process.env.SUBLEDGER_DB_PATH
})

describe('server api routes', () => {
  it('returns an empty initial state', async () => {
    const { response, body } = await request<AppState>('/api/state')

    expect(response.status).toBe(200)
    expect(body.services).toEqual([])
    expect(body.plans).toEqual([])
    expect(body.subscriptions).toEqual([])
    expect(body.payments).toEqual([])
    expect(body.jointRenewals).toEqual([])
    expect(body.snapshots).toEqual([])
    expect(body.jointQuotes).toEqual([])
    expect(body.stats.activeCount).toBe(0)
  })

  it('creates a subscription with an initial payment', async () => {
    const state = await createSubscription({
      serviceName: '视频会员',
      category: '影音',
      planName: '年付',
      cycleMonths: 12,
      listPrice: 19800,
      platform: '官网',
      account: 'user@example.com',
      autoRenew: true,
      note: '首年',
      payment: { paidAt: today, amount: 19800, note: '首笔' },
    })

    const subscription = findSubscription(state, '视频会员')
    expect(state.services).toHaveLength(1)
    expect(state.plans).toHaveLength(1)
    expect(state.plans[0]).toMatchObject({
      serviceName: '视频会员',
      category: '影音',
      name: '年付',
      cycleMonths: 12,
      listPrice: 19800,
      subscribed: true,
    })
    expect(subscription).toMatchObject({
      status: 'active',
      platform: '官网',
      account: 'user@example.com',
      autoRenew: true,
      note: '首年',
      paymentCount: 1,
      totalSpent: 19800,
      nextRenewalAt: addMonths(today, 12),
    })
    expect(subscription.lastPayment?.amount).toBe(19800)
    expect(subscription.prevPayment).toBeNull()
    expect(state.stats.activeCount).toBe(1)
    expect(state.stats.totalSpent).toBe(19800)
  })

  it('creates a planned subscription and activates it with a payment', async () => {
    const state = await createSubscription({
      serviceName: '云存储',
      category: '云服务',
      planName: '月付',
      cycleMonths: 1,
      listPrice: 2100,
      status: 'planned',
    })

    let subscription = findSubscription(state, '云存储')
    expect(subscription.status).toBe('planned')
    expect(subscription.nextRenewalAt).toBeNull()
    expect(subscription.paymentCount).toBe(0)

    const { response, body } = await jsonRequest<AppState>(
      'POST',
      `/api/subscriptions/${subscription.id}/payments`,
      {
        paidAt: today,
        amount: 2100,
        durationDays: 30,
        note: '开通',
      },
    )

    expect(response.status).toBe(201)
    subscription = findSubscription(body, '云存储')
    expect(subscription.status).toBe('active')
    expect(subscription.nextRenewalAt).toBe(addDays(today, 30))
    expect(subscription.paymentCount).toBe(1)
    expect(subscription.lastPayment?.amount).toBe(2100)
  })

  it('keeps a manual next renewal date when creating with a payment', async () => {
    const manualNext = addDays(today, 20)
    const state = await createSubscription({
      serviceName: '手动续费日',
      planName: '月付',
      cycleMonths: 1,
      listPrice: 1000,
      status: 'planned',
      nextRenewalOverride: manualNext,
      payment: { paidAt: today, amount: 1000 },
    })

    const subscription = findSubscription(state, '手动续费日')
    expect(subscription.status).toBe('active')
    expect(subscription.nextRenewalOverride).toBe(manualNext)
    expect(subscription.nextRenewalAt).toBe(manualNext)
  })

  it('updates subscription and plan details', async () => {
    const state = await createSubscription({
      serviceName: '更新服务',
      category: '工具',
      planName: '月付',
      cycleMonths: 1,
      listPrice: 1000,
      startedAt: today,
    })
    const subscription = findSubscription(state, '更新服务')
    const manualNext = addDays(today, 45)

    const { response, body } = await jsonRequest<AppState>(
      'PUT',
      `/api/subscriptions/${subscription.id}`,
      {
        category: '效率',
        planName: '季付',
        cycleMonths: 3,
        listPrice: 3000,
        platform: 'App Store',
        account: 'new@example.com',
        startedAt: today,
        nextRenewalOverride: manualNext,
        autoRenew: false,
        status: 'active',
        note: '改过',
      },
    )

    expect(response.status).toBe(200)
    const updated = findSubscription(body, '更新服务')
    expect(updated).toMatchObject({
      category: '效率',
      planName: '季付',
      cycleMonths: 3,
      cycleDays: null,
      listPrice: 3000,
      platform: 'App Store',
      account: 'new@example.com',
      nextRenewalOverride: manualNext,
      nextRenewalAt: manualNext,
      autoRenew: false,
      status: 'active',
      note: '改过',
    })
  })

  it('adds and deletes a payment', async () => {
    const state = await createSubscription({
      serviceName: '支付服务',
      planName: '年付',
      cycleMonths: 12,
      listPrice: 12000,
      payment: { paidAt: today, amount: 12000 },
    })
    const subscription = findSubscription(state, '支付服务')
    const firstNext = subscription.nextRenewalAt
    expect(firstNext).not.toBeNull()

    const { response, body } = await jsonRequest<AppState>(
      'POST',
      `/api/subscriptions/${subscription.id}/payments`,
      {
        paidAt: today,
        amount: 500,
        durationDays: 30,
        note: '加购',
      },
    )

    expect(response.status).toBe(201)
    const paid = findSubscription(body, '支付服务')
    expect(paid.paymentCount).toBe(2)
    expect(paid.lastPayment?.amount).toBe(500)
    expect(paid.nextRenewalAt).toBe(addDays(firstNext!, 30))

    const added = body.payments.find(
      (item) => item.subscriptionId === subscription.id && item.amount === 500,
    )
    expect(added).toBeDefined()

    const deleted = await jsonRequest<AppState>(
      'DELETE',
      `/api/payments/${added!.id}`,
      {},
    )
    expect(deleted.response.status).toBe(200)
    const afterDelete = findSubscription(deleted.body, '支付服务')
    expect(afterDelete.paymentCount).toBe(1)
    expect(
      deleted.body.payments.some((item) => item.id === added!.id),
    ).toBe(false)
  })

  it('splits a joint renewal across members', async () => {
    const stateA = await createSubscription({
      serviceName: '拼车A',
      planName: '年付',
      cycleMonths: 12,
      listPrice: 12000,
    })
    const a = findSubscription(stateA, '拼车A')
    const stateB = await createSubscription({
      serviceName: '拼车B',
      planName: '年付',
      cycleMonths: 12,
      listPrice: 12000,
    })
    const b = findSubscription(stateB, '拼车B')
    const nextA = a.nextRenewalAt
    const nextB = b.nextRenewalAt

    const { response, body } = await jsonRequest<AppState>(
      'POST',
      '/api/joint-renewals',
      {
        total: 1000,
        paidAt: today,
        costMode: 'split',
        mainSubscriptionId: a.id,
        note: '拼车续费',
        members: [
          { subscriptionId: a.id, durationDays: 30 },
          { subscriptionId: b.id, durationDays: 60 },
        ],
      },
    )

    expect(response.status).toBe(201)
    expect(body.jointRenewals).toHaveLength(1)
    const renewal = body.jointRenewals[0]
    expect(renewal).toMatchObject({
      total: 1000,
      cycleMonths: 2,
      costMode: 'split',
      note: '拼车续费',
    })
    expect(renewal.members.map((member) => member.subscriptionId)).toEqual([
      a.id,
      b.id,
    ])
    expect(renewal.members.map((member) => member.amount)).toEqual([334, 666])
    expect(findSubscription(body, '拼车A').nextRenewalAt).toBe(
      addDays(nextA!, 30),
    )
    expect(findSubscription(body, '拼车B').nextRenewalAt).toBe(
      addDays(nextB!, 60),
    )

    const jointPayment = body.payments.find(
      (item) => item.jointRenewalId === renewal.id,
    )
    expect(jointPayment).toBeDefined()

    const blocked = await jsonRequest<{ error: string }>(
      'DELETE',
      `/api/payments/${jointPayment!.id}`,
      {},
    )
    expect(blocked.response.status).toBe(400)
    expect(blocked.body.error).toContain('联合续费')

    const deleted = await jsonRequest<AppState>(
      'DELETE',
      `/api/joint-renewals/${renewal.id}`,
      {},
    )
    expect(deleted.response.status).toBe(200)
    expect(deleted.body.jointRenewals).toEqual([])
    expect(deleted.body.payments).toEqual([])
  })

  it('assigns a joint renewal to the main member', async () => {
    const stateA = await createSubscription({
      serviceName: '主会员',
      planName: '年付',
      cycleMonths: 12,
      listPrice: 12000,
    })
    const a = findSubscription(stateA, '主会员')
    const stateB = await createSubscription({
      serviceName: '副会员',
      planName: '年付',
      cycleMonths: 12,
      listPrice: 12000,
    })
    const b = findSubscription(stateB, '副会员')

    const { response, body } = await jsonRequest<AppState>(
      'POST',
      '/api/joint-renewals',
      {
        total: 1000,
        paidAt: today,
        costMode: 'main',
        mainSubscriptionId: a.id,
        members: [
          { subscriptionId: a.id, durationDays: 30 },
          { subscriptionId: b.id, durationDays: 60 },
        ],
      },
    )

    expect(response.status).toBe(201)
    expect(body.jointRenewals[0].costMode).toBe('main')
    expect(body.jointRenewals[0].members.map((member) => member.amount)).toEqual(
      [1000, 0],
    )
  })

  it('creates, updates, and deletes a plan snapshot', async () => {
    const created = await jsonRequest<AppState>('POST', '/api/plans', {
      serviceName: '比价服务',
      category: '工具',
      planName: '年付',
      cycleMonths: 12,
      listPrice: 12000,
      note: '套餐备注',
      quote: {
        capturedAt: today,
        price: 11000,
        platform: '淘宝',
        note: '促销',
      },
    })

    expect(created.response.status).toBe(201)
    const plan = created.body.plans.find(
      (item) => item.serviceName === '比价服务',
    )
    expect(plan).toBeDefined()
    expect(plan).toMatchObject({
      name: '年付',
      cycleMonths: 12,
      listPrice: 12000,
      note: '套餐备注',
    })
    expect(created.body.snapshots).toHaveLength(1)
    const snapshot = created.body.snapshots[0]
    expect(snapshot).toMatchObject({
      planId: plan!.id,
      price: 11000,
      platform: '淘宝',
      note: '促销',
      cycleMonths: 12,
    })

    const updated = await jsonRequest<AppState>(
      'PUT',
      `/api/snapshots/${snapshot.id}`,
      {
        capturedAt: today,
        price: 10500,
        platform: '京东',
        note: '降价',
        durationDays: 365,
      },
    )
    expect(updated.response.status).toBe(200)
    expect(updated.body.snapshots[0]).toMatchObject({
      id: snapshot.id,
      price: 10500,
      platform: '京东',
      note: '降价',
      durationDays: 365,
      cycleMonths: 12,
    })

    const deleted = await jsonRequest<AppState>(
      'DELETE',
      `/api/snapshots/${snapshot.id}`,
      {},
    )
    expect(deleted.response.status).toBe(200)
    expect(deleted.body.snapshots).toEqual([])
  })

  it('blocks deleting a plan that is in use', async () => {
    const state = await createSubscription({
      serviceName: '套餐占用',
      planName: '年付',
      cycleMonths: 12,
    })
    const subscription = findSubscription(state, '套餐占用')
    const plan = state.plans.find((item) => item.id === subscription.planId)
    expect(plan).toBeDefined()

    const blocked = await jsonRequest<{ error: string }>(
      'DELETE',
      `/api/plans/${plan!.id}`,
      {},
    )
    expect(blocked.response.status).toBe(409)
    expect(blocked.body.error).toContain('套餐')

    await jsonRequest<AppState>(
      'DELETE',
      `/api/subscriptions/${subscription.id}`,
      {},
    )
    const deleted = await jsonRequest<AppState>(
      'DELETE',
      `/api/plans/${plan!.id}`,
      {},
    )
    expect(deleted.response.status).toBe(200)
    expect(deleted.body.plans.some((item) => item.id === plan!.id)).toBe(false)
  })

  it('creates, updates, and deletes a joint quote', async () => {
    const stateA = await createSubscription({
      serviceName: '报价A',
      planName: '年付',
      cycleMonths: 12,
    })
    const a = findSubscription(stateA, '报价A')
    const stateB = await createSubscription({
      serviceName: '报价B',
      planName: '年付',
      cycleMonths: 12,
    })
    const b = findSubscription(stateB, '报价B')

    const created = await jsonRequest<AppState>('POST', '/api/joint-quotes', {
      capturedAt: today,
      total: 1000,
      costMode: 'split',
      platform: '拼车平台',
      note: '联合报价',
      mainSubscriptionId: a.id,
      items: [
        { subscriptionId: a.id, durationDays: 30 },
        { subscriptionId: b.id, durationDays: 60 },
      ],
    })

    expect(created.response.status).toBe(201)
    const quote = created.body.jointQuotes[0]
    expect(quote).toMatchObject({
      total: 1000,
      cycleMonths: 2,
      costMode: 'split',
      platform: '拼车平台',
      note: '联合报价',
    })
    expect(quote.items.map((item) => item.amount)).toEqual([334, 666])

    const changedItems = await jsonRequest<AppState>(
      'PUT',
      `/api/joint-quotes/${quote.id}`,
      {
        capturedAt: today,
        total: 1200,
        costMode: 'split',
        platform: '拼车平台',
        mainSubscriptionId: a.id,
        items: [
          { subscriptionId: a.id, durationDays: 60 },
          { subscriptionId: b.id, durationDays: 90 },
        ],
      },
    )
    expect(changedItems.response.status).toBe(200)
    expect(changedItems.body.jointQuotes[0]).toMatchObject({
      total: 1200,
      cycleMonths: 3,
      costMode: 'split',
    })
    expect(
      changedItems.body.jointQuotes[0].items.map((item) => item.amount),
    ).toEqual([480, 720])

    const updated = await jsonRequest<AppState>(
      'PUT',
      `/api/joint-quotes/${quote.id}`,
      {
        capturedAt: today,
        total: 1200,
        costMode: 'main',
        platform: '拼车平台2',
        note: '改价',
        mainSubscriptionId: a.id,
      },
    )
    expect(updated.response.status).toBe(200)
    expect(updated.body.jointQuotes[0]).toMatchObject({
      total: 1200,
      cycleMonths: 3,
      costMode: 'main',
      platform: '拼车平台2',
      note: '改价',
    })
    expect(updated.body.jointQuotes[0].items.map((item) => item.amount)).toEqual(
      [1200, 0],
    )

    const invalid = await jsonRequest<{ error: string }>(
      'PUT',
      `/api/joint-quotes/${quote.id}`,
      {
        capturedAt: today,
        total: 1200,
        costMode: 'main',
        platform: '拼车平台2',
        mainSubscriptionId: a.id,
        items: [{ subscriptionId: a.id, durationDays: 30 }],
      },
    )
    expect(invalid.response.status).toBe(400)
    expect(invalid.body.error).toContain('不能添加或删除')

    const deleted = await jsonRequest<AppState>(
      'DELETE',
      `/api/joint-quotes/${quote.id}`,
      {},
    )
    expect(deleted.response.status).toBe(200)
    expect(deleted.body.jointQuotes).toEqual([])
  })

  it('exports and imports all data', async () => {
    await createSubscription({
      serviceName: '导出服务',
      planName: '年付',
      cycleMonths: 12,
      listPrice: 9900,
      payment: { paidAt: today, amount: 9900, note: '导出' },
    })

    const exported = await request<Record<string, unknown>>(
      '/api/export/json',
    )
    expect(exported.response.status).toBe(200)
    expect(exported.response.headers.get('content-type')).toContain(
      'application/json',
    )
    expect(exported.response.headers.get('content-disposition')).toContain(
      'subledger-',
    )
    expect(exported.body.app).toBe('subledger')
    expect(exported.body.subscriptions).toHaveLength(1)

    const reset = await jsonRequest<AppState>('DELETE', '/api/data', {
      confirm: 'DELETE',
    })
    expect(reset.response.status).toBe(200)

    const imported = await jsonRequest<ImportResponse>(
      'POST',
      '/api/import/json',
      exported.body,
    )
    expect(imported.response.status).toBe(200)
    expect(imported.body.services).toHaveLength(1)
    expect(imported.body.subscriptions).toHaveLength(1)
    expect(imported.body.payments).toHaveLength(1)
    expect(imported.body.imported).toMatchObject({
      servicesAdded: 1,
      plansAdded: 1,
      subscriptionsAdded: 1,
      paymentsAdded: 1,
    })
  })

  it('seeds demo data and rejects a second seed', async () => {
    const seeded = await jsonRequest<AppState>('POST', '/api/seed', {})
    expect(seeded.response.status).toBe(201)
    expect(seeded.body.services).toHaveLength(5)
    expect(seeded.body.subscriptions).toHaveLength(5)
    expect(seeded.body.payments.length).toBeGreaterThan(0)
    expect(seeded.body.stats.totalSpent).toBeGreaterThan(0)

    const again = await jsonRequest<{ error: string }>(
      'POST',
      '/api/seed',
      {},
    )
    expect(again.response.status).toBe(409)
    expect(again.body.error).toContain('已有数据')
  })

  it('resets all data and writes a backup', async () => {
    await createSubscription({
      serviceName: '重置服务',
      planName: '年付',
      cycleMonths: 12,
    })

    const backupDir = path.join(tempDir, 'backups')
    const countBackups = () =>
      fs.existsSync(backupDir)
        ? fs.readdirSync(backupDir).filter((file) => file.endsWith('.db'))
            .length
        : 0
    const before = countBackups()

    const denied = await jsonRequest<{ error: string }>('DELETE', '/api/data', {
      confirm: 'NO',
    })
    expect(denied.response.status).toBe(400)

    const stillThere = await request<AppState>('/api/state')
    expect(stillThere.body.subscriptions).toHaveLength(1)

    const reset = await jsonRequest<AppState>('DELETE', '/api/data', {
      confirm: 'DELETE',
    })
    expect(reset.response.status).toBe(200)
    expect(reset.body.services).toEqual([])
    expect(reset.body.subscriptions).toEqual([])
    expect(countBackups()).toBeGreaterThan(before)
  })

  it('returns validation and not-found errors', async () => {
    const invalidId = await jsonRequest<{ error: string }>(
      'PUT',
      '/api/subscriptions/abc',
      {},
    )
    expect(invalidId.response.status).toBe(400)
    expect(invalidId.body.error).toContain('不存在')

    const missingSubscription = await jsonRequest<{ error: string }>(
      'PUT',
      '/api/subscriptions/999',
      {},
    )
    expect(missingSubscription.response.status).toBe(404)

    const missingPayment = await jsonRequest<{ error: string }>(
      'DELETE',
      '/api/payments/999',
      {},
    )
    expect(missingPayment.response.status).toBe(404)

    const missingPlan = await jsonRequest<{ error: string }>(
      'DELETE',
      '/api/plans/999',
      {},
    )
    expect(missingPlan.response.status).toBe(404)

    const missingSnapshot = await jsonRequest<{ error: string }>(
      'DELETE',
      '/api/snapshots/999',
      {},
    )
    expect(missingSnapshot.response.status).toBe(404)

    const missingJointRenewal = await jsonRequest<{ error: string }>(
      'DELETE',
      '/api/joint-renewals/999',
      {},
    )
    expect(missingJointRenewal.response.status).toBe(404)

    const missingJointQuote = await jsonRequest<{ error: string }>(
      'DELETE',
      '/api/joint-quotes/999',
      {},
    )
    expect(missingJointQuote.response.status).toBe(404)

    const missingPlanForSnapshot = await jsonRequest<{ error: string }>(
      'POST',
      '/api/snapshots',
      { planId: 999, capturedAt: today, price: 100, platform: '测试' },
    )
    expect(missingPlanForSnapshot.response.status).toBe(404)

    const state = await createSubscription({
      serviceName: '校验服务',
      planName: '年付',
      cycleMonths: 12,
    })
    const subscription = findSubscription(state, '校验服务')
    const tooFewMembers = await jsonRequest<{ error: string }>(
      'POST',
      '/api/joint-renewals',
      {
        total: 100,
        paidAt: today,
        costMode: 'split',
        mainSubscriptionId: subscription.id,
        members: [{ subscriptionId: subscription.id, durationDays: 30 }],
      },
    )
    expect(tooFewMembers.response.status).toBe(400)
    expect(tooFewMembers.body.error).toContain('至少需要两个')

    const badQuote = await jsonRequest<{ error: string }>(
      'POST',
      '/api/plans',
      {
        serviceName: '坏报价',
        category: '其他',
        planName: '年付',
        cycleMonths: 12,
        quote: 'bad',
      },
    )
    expect(badQuote.response.status).toBe(400)
    expect(badQuote.body.error).toContain('平台报价格式不正确')
  })
})
