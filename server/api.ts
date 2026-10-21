import { Router, type Request, type Response } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { db, dbPath } from './db'
import { DAYS_PER_MONTH } from '../shared/duration'
import { HttpError } from './errors'
import { seedDemoData } from './seed'
import { buildState } from './store'
import { exportAll, importAll } from './transfer'
import { addDays, addMonths, nowISO, todayISO } from './util'
import {
  costMode,
  date,
  idParam,
  integer,
  maybeDate,
  optionalText,
  parseCycle,
  parseMembers,
  readQuote,
  status,
  text,
} from './validation'
import type { JointMemberInput, QuoteInput } from './validation'

function route(handler: (req: Request, res: Response) => void) {
  return (req: Request, res: Response) => {
    try {
      handler(req, res)
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500
      const message = error instanceof Error ? error.message : '服务器错误'
      if (status >= 500) console.error(error)
      res.status(status).json({ error: message })
    }
  }
}

function insertPriceSnapshot(planId: number, quote: QuoteInput) {
  db.prepare(
    `INSERT INTO price_snapshots
      (plan_id, captured_at, duration_days, price, cycle_months, cycle_days, platform, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    planId,
    quote.capturedAt,
    quote.durationDays,
    quote.price,
    quote.cycleMonths,
    quote.cycleDays,
    quote.platform,
    quote.note,
    nowISO(),
  )
}

function upsertService(name: string, category: string): number {
  const existing = db
    .prepare('SELECT id FROM services WHERE name = ? COLLATE NOCASE')
    .get(name) as { id: number } | undefined

  if (existing) {
    db.prepare('UPDATE services SET category = ? WHERE id = ?').run(category, existing.id)
    return existing.id
  }

  const info = db
    .prepare('INSERT INTO services (name, category, created_at) VALUES (?, ?, ?)')
    .run(name, category, nowISO())
  return Number(info.lastInsertRowid)
}

type PlanInput = {
  name: string
  cycleMonths: number
  cycleDays: number | null
  listPrice: number
  note: string | null
}

function upsertPlan(serviceId: number, input: PlanInput): number {
  const existing = db
    .prepare(
      `SELECT id FROM plans
       WHERE service_id = ? AND name = ? COLLATE NOCASE AND cycle_months = ?
         AND IFNULL(cycle_days, -1) = IFNULL(?, -1)`,
    )
    .get(serviceId, input.name, input.cycleMonths, input.cycleDays) as
    | { id: number }
    | undefined

  if (existing) {
    db.prepare(
      'UPDATE plans SET list_price = ?, note = COALESCE(?, note) WHERE id = ?',
    ).run(input.listPrice, input.note, existing.id)
    return existing.id
  }

  const info = db
    .prepare(
      `INSERT INTO plans (service_id, name, cycle_months, cycle_days, list_price, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      serviceId,
      input.name,
      input.cycleMonths,
      input.cycleDays,
      input.listPrice,
      input.note,
      nowISO(),
    )
  return Number(info.lastInsertRowid)
}

function getSubscription(id: number) {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id) as
    | {
        id: number
        plan_id: number
        platform: string | null
        account: string | null
        started_at: string
        next_renewal_override: string | null
        auto_renew: number
        status: string
        note: string | null
      }
    | undefined
  if (!sub) throw new HttpError(404, '会员记录不存在')
  return sub
}

type PaymentOptions = {
  /** 新建会员时的首笔支付，从支付日直接起算，不再叠加原到期日。 */
  initial?: boolean
}

function insertPayment(
  subscriptionId: number,
  body: Record<string, unknown>,
  options: PaymentOptions = {},
) {
  const paidAt = date(body.paidAt, '支付日期')
  const amount = integer(body.amount, '支付金额', 0, 1_000_000_000_000)
  const durationDays =
    body.durationDays === null ||
    body.durationDays === undefined ||
    body.durationDays === ''
      ? null
      : integer(body.durationDays, '续费时长（天）', 1, 3650)

  const sub = db
    .prepare(
      `SELECT s.id, s.started_at, s.next_renewal_override, s.status,
              p.cycle_months, p.cycle_days
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.id = ?`,
    )
    .get(subscriptionId) as
    | {
        id: number
        started_at: string
        next_renewal_override: string | null
        status: string
        cycle_months: number
        cycle_days: number | null
      }
    | undefined
  if (!sub) throw new HttpError(404, '会员记录不存在')

  const last = db
    .prepare(
      `SELECT paid_at FROM payments
       WHERE subscription_id = ?
       ORDER BY paid_at DESC, id DESC
       LIMIT 1`,
    )
    .get(subscriptionId) as { paid_at: string } | undefined

  const planned = sub.status === 'planned'
  const planNext =
    sub.cycle_days !== null && sub.cycle_days > 0
      ? addDays(last?.paid_at ?? sub.started_at, sub.cycle_days)
      : sub.cycle_months > 0
        ? addMonths(last?.paid_at ?? sub.started_at, sub.cycle_months)
        : null
  const currentNext = planned ? null : sub.next_renewal_override || planNext
  // 到期日还在未来就从原到期日顺延；已过期、想买或首笔支付则从本次支付日起算。
  const base =
    options.initial || planned || !currentNext || currentNext <= paidAt
      ? paidAt
      : currentNext

  const nextDate =
    durationDays !== null
      ? addDays(base, durationDays)
      : sub.cycle_days !== null && sub.cycle_days > 0
        ? addDays(base, sub.cycle_days)
        : sub.cycle_months > 0
          ? addMonths(base, sub.cycle_months)
          : null

  const info = db
    .prepare(
      `INSERT INTO payments
        (subscription_id, paid_at, amount, note, duration_days, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      subscriptionId,
      paidAt,
      amount,
      optionalText(body.note, 300),
      durationDays,
      nowISO(),
    )

  // 新建会员时手填的下次续费日优先，不被首笔支付推算覆盖。
  const keepManual = options.initial && Boolean(sub.next_renewal_override)
  if (nextDate && !keepManual) {
    db.prepare(
      'UPDATE subscriptions SET next_renewal_override = ?, status = ? WHERE id = ?',
    ).run(nextDate, 'active', subscriptionId)
  } else {
    db.prepare("UPDATE subscriptions SET status = 'active' WHERE id = ?").run(
      subscriptionId,
    )
  }

  return { id: Number(info.lastInsertRowid), amount, durationDays, nextDate }
}

export const apiRouter = Router()

apiRouter.get(
  '/state',
  route((_req, res) => {
    res.json(buildState())
  }),
)

apiRouter.post(
  '/subscriptions',
  route((req, res) => {
    const body = req.body ?? {}
    const serviceName = text(body.serviceName, '服务名称', 80)
    const category = text(body.category, '类别', 30)
    const planName = text(body.planName, '套餐名称', 80)
    const { cycleMonths, cycleDays } = parseCycle(body, {
      cycleMonths: 12,
      cycleDays: null,
    })
    const listPrice = integer(body.listPrice ?? 0, '标价', 0, 1_000_000_000_000)
    const platform = optionalText(body.platform, 60)
    const account = optionalText(body.account, 120)
    const startedAt = date(body.startedAt, '开始日期')
    const nextRenewalOverride = maybeDate(body.nextRenewalOverride, '下次续费日期')
    const requestedStatus = status(body.status ?? 'active')
    const note = optionalText(body.note, 300)
    const autoRenew = body.autoRenew === true

    const payment =
      body.payment && typeof body.payment === 'object'
        ? (body.payment as Record<string, unknown>)
        : null
    // 想买只是一条待购清单；一旦在创建时记了支付，就说明已经买了。
    const subscriptionStatus = payment && requestedStatus === 'planned' ? 'active' : requestedStatus

    const transaction = db.transaction(() => {
      const serviceId = upsertService(serviceName, category)
      const planId = upsertPlan(serviceId, {
        name: planName,
        cycleMonths,
        cycleDays,
        listPrice,
        note: null,
      })
      const subInfo = db
        .prepare(
          `INSERT INTO subscriptions
            (plan_id, platform, account, started_at, next_renewal_override, auto_renew, status, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          planId,
          platform,
          account,
          startedAt,
          nextRenewalOverride,
          autoRenew ? 1 : 0,
          subscriptionStatus,
          note,
          nowISO(),
        )
      const subscriptionId = Number(subInfo.lastInsertRowid)
      if (payment) insertPayment(subscriptionId, payment, { initial: true })
      return subscriptionId
    })

    transaction()
    res.status(201).json(buildState())
  }),
)

apiRouter.put(
  '/subscriptions/:id',
  route((req, res) => {
    const id = idParam(req.params.id, '会员记录')
    const sub = getSubscription(id)
    const body = req.body ?? {}
    const planRow = db.prepare('SELECT * FROM plans WHERE id = ?').get(sub.plan_id) as
      | {
          id: number
          service_id: number
          name: string
          cycle_months: number
          cycle_days: number | null
          list_price: number
        }
      | undefined
    if (!planRow) throw new HttpError(404, '套餐不存在')

    const category = text(body.category ?? '其他', '类别', 30)
    const planName = text(body.planName ?? planRow.name, '套餐名称', 80)
    const { cycleMonths, cycleDays } = parseCycle(body, {
      cycleMonths: planRow.cycle_months,
      cycleDays: planRow.cycle_days,
    })
    const listPrice = integer(
      body.listPrice ?? planRow.list_price,
      '标价',
      0,
      1_000_000_000_000,
    )
    const subscriptionStatus = status(body.status ?? sub.status)
    const startedAt = date(body.startedAt ?? sub.started_at, '开始日期')
    const nextRenewalOverride = maybeDate(body.nextRenewalOverride, '下次续费日期')
    const autoRenew =
      body.autoRenew === undefined ? Boolean(sub.auto_renew) : body.autoRenew !== false

    db.transaction(() => {
      db.prepare('UPDATE services SET category = ? WHERE id = ?').run(category, planRow.service_id)
      db.prepare(
        `UPDATE plans
         SET name = ?, cycle_months = ?, cycle_days = ?, list_price = ?
         WHERE id = ?`,
      ).run(planName, cycleMonths, cycleDays, listPrice, planRow.id)
      db.prepare(
        `UPDATE subscriptions
         SET platform = ?, account = ?, started_at = ?, next_renewal_override = ?, auto_renew = ?, status = ?, note = ?
         WHERE id = ?`,
      ).run(
        optionalText(body.platform, 60),
        optionalText(body.account, 120),
        startedAt,
        nextRenewalOverride,
        autoRenew ? 1 : 0,
        subscriptionStatus,
        optionalText(body.note, 300),
        id,
      )
    })()

    res.json(buildState())
  }),
)

apiRouter.delete(
  '/subscriptions/:id',
  route((req, res) => {
    const id = idParam(req.params.id, '会员记录')
    getSubscription(id)
    db.prepare('DELETE FROM subscriptions WHERE id = ?').run(id)
    res.json(buildState())
  }),
)

type JointMemberRow = {
  id: number
  started_at: string
  next_renewal_override: string | null
  status: string
  plan_cycle: number
  plan_cycle_days: number | null
}

apiRouter.post(
  '/joint-renewals',
  route((req, res) => {
    const body = req.body ?? {}
    const total = integer(body.total, '总金额', 0, 1_000_000_000_000)
    const paidAt = date(body.paidAt, '支付日期')
    const mode = costMode(body.costMode)
    const note = optionalText(body.note, 300)

    const members = parseMembers(body.members, '参与会员')
    if (members.length < 2) {
      throw new HttpError(400, '联合续费至少需要两个会员')
    }

    const mainSubscriptionId = integer(body.mainSubscriptionId, '费用归属会员', 1)
    if (!members.some((member) => member.subscriptionId === mainSubscriptionId)) {
      throw new HttpError(400, '费用归属会员必须在参与会员中')
    }

    const totalDays = members.reduce((sum, member) => sum + member.days, 0)

    const memberStmt = db.prepare(
      `SELECT s.id, s.started_at, s.next_renewal_override, s.status,
              p.cycle_months AS plan_cycle, p.cycle_days AS plan_cycle_days
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.id = ?`,
    )
    const lastPaymentStmt = db.prepare(
      `SELECT paid_at FROM payments
       WHERE subscription_id = ?
       ORDER BY paid_at DESC, id DESC
       LIMIT 1`,
    )
    const insertJoint = db.prepare(
      `INSERT INTO joint_renewals
        (main_subscription_id, paid_at, total, cycle_months, cost_mode, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    const insertPayment = db.prepare(
      `INSERT INTO payments
        (subscription_id, paid_at, amount, note, joint_renewal_id, duration_days, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    const update = db.prepare(
      'UPDATE subscriptions SET next_renewal_override = ?, status = ? WHERE id = ?',
    )

    db.transaction(() => {
      const prepared = members.map((member) => {
        const row = memberStmt.get(member.subscriptionId) as
          | JointMemberRow
          | undefined
        if (!row) throw new HttpError(404, '会员记录不存在')
        const last = lastPaymentStmt.get(member.subscriptionId) as
          | { paid_at: string }
          | undefined
        const planNext =
          row.plan_cycle_days !== null && row.plan_cycle_days > 0
            ? addDays(last?.paid_at ?? row.started_at, row.plan_cycle_days)
            : addMonths(last?.paid_at ?? row.started_at, row.plan_cycle)
        const currentNext =
          row.status === 'planned'
            ? paidAt
            : row.next_renewal_override || planNext
        // 到期日还在未来就从原到期日顺延，已经过期则从本次支付日重新起算。
        const base =
          row.status !== 'planned' && currentNext > paidAt ? currentNext : paidAt
        const nextDate = addDays(base, member.days)
        return { member, row, nextDate }
      })

      const bundleMonths = Math.max(
        ...members.map((member) => Math.round(member.days / DAYS_PER_MONTH)),
        0,
      )
      const jointInfo = insertJoint.run(
        mainSubscriptionId,
        paidAt,
        total,
        bundleMonths,
        mode,
        note,
        nowISO(),
      )
      const jointRenewalId = Number(jointInfo.lastInsertRowid)

      // 均分时按每个会员实际拿到的时长分摊，余数记在主会员。
      let assigned = 0
      const amounts = prepared.map(({ member }) => {
        if (mode === 'main') {
          const amount = member.subscriptionId === mainSubscriptionId ? total : 0
          assigned += amount
          return amount
        }
        const amount = Math.floor((total * member.days) / totalDays)
        assigned += amount
        return amount
      })
      if (mode === 'split') {
        const mainIndex = prepared.findIndex(
          ({ member }) => member.subscriptionId === mainSubscriptionId,
        )
        if (mainIndex >= 0) amounts[mainIndex] += total - assigned
      }

      prepared.forEach(({ member, row, nextDate }, index) => {
        insertPayment.run(
          member.subscriptionId,
          paidAt,
          amounts[index],
          note,
          jointRenewalId,
          member.days,
          nowISO(),
        )
        // 想买的会员一旦参与联合续费，就直接转为活跃。
        const nextStatus =
          row.status === 'planned' || nextDate >= todayISO() ? 'active' : row.status
        update.run(nextDate, nextStatus, member.subscriptionId)
      })
    })()

    res.status(201).json(buildState())
  }),
)

apiRouter.delete(
  '/joint-renewals/:id',
  route((req, res) => {
    const id = idParam(req.params.id, '联合续费记录')
    const info = db.prepare('DELETE FROM joint_renewals WHERE id = ?').run(id)
    if (info.changes === 0) throw new HttpError(404, '联合续费记录不存在')
    res.json(buildState())
  }),
)

apiRouter.post(
  '/subscriptions/:id/payments',
  route((req, res) => {
    const id = idParam(req.params.id, '会员记录')
    getSubscription(id)
    db.transaction(() => {
      insertPayment(id, req.body ?? {})
    })()
    res.status(201).json(buildState())
  }),
)

apiRouter.delete(
  '/payments/:id',
  route((req, res) => {
    const id = idParam(req.params.id, '支付记录')
    const payment = db
      .prepare('SELECT joint_renewal_id FROM payments WHERE id = ?')
      .get(id) as { joint_renewal_id: number | null } | undefined
    if (!payment) throw new HttpError(404, '支付记录不存在')
    if (payment.joint_renewal_id !== null) {
      throw new HttpError(400, '这笔支付属于联合续费，请删除整条联合续费记录')
    }
    db.prepare('DELETE FROM payments WHERE id = ?').run(id)
    res.json(buildState())
  }),
)

apiRouter.post(
  '/plans',
  route((req, res) => {
    const body = req.body ?? {}
    const serviceName = text(body.serviceName, '服务名称', 80)
    const category = text(body.category, '类别', 30)
    const planName = text(body.planName, '套餐名称', 80)
    const { cycleMonths, cycleDays } = parseCycle(body, {
      cycleMonths: 12,
      cycleDays: null,
    })
    const listPrice = integer(body.listPrice ?? 0, '标价', 0, 1_000_000_000_000)
    const note = optionalText(body.note, 300)

    const quoteBody = body.quote
    let quote: QuoteInput | null = null
    if (quoteBody !== null && quoteBody !== undefined) {
      if (typeof quoteBody !== 'object' || Array.isArray(quoteBody)) {
        throw new HttpError(400, '平台报价格式不正确')
      }
      quote = readQuote(quoteBody as Record<string, unknown>, {
        cycleMonths,
        cycleDays,
      })
    }

    db.transaction(() => {
      const serviceId = upsertService(serviceName, category)
      const planId = upsertPlan(serviceId, {
        name: planName,
        cycleMonths,
        cycleDays,
        listPrice,
        note,
      })
      if (quote) insertPriceSnapshot(planId, quote)
    })()

    res.status(201).json(buildState())
  }),
)

apiRouter.delete(
  '/plans/:id',
  route((req, res) => {
    const id = idParam(req.params.id, '套餐')
    const used = db
      .prepare('SELECT COUNT(*) AS count FROM subscriptions WHERE plan_id = ?')
      .get(id) as { count: number }
    if (used.count > 0) {
      throw new HttpError(409, '该套餐还有会员记录，请先删除对应会员')
    }
    const info = db.prepare('DELETE FROM plans WHERE id = ?').run(id)
    if (info.changes === 0) throw new HttpError(404, '套餐不存在')
    res.json(buildState())
  }),
)

apiRouter.post(
  '/snapshots',
  route((req, res) => {
    const body = req.body ?? {}
    const planId = integer(body.planId, '套餐', 1)
    const plan = db
      .prepare('SELECT id, cycle_months, cycle_days FROM plans WHERE id = ?')
      .get(planId) as
      | { id: number; cycle_months: number; cycle_days: number | null }
      | undefined
    if (!plan) throw new HttpError(404, '套餐不存在')

    const quote = readQuote(body, {
      cycleMonths: plan.cycle_months,
      cycleDays: plan.cycle_days,
    })
    insertPriceSnapshot(planId, quote)

    res.status(201).json(buildState())
  }),
)

apiRouter.put(
  '/snapshots/:id',
  route((req, res) => {
    const id = idParam(req.params.id, '比价记录')
    const snapshot = db
      .prepare(
        'SELECT id, cycle_months, cycle_days FROM price_snapshots WHERE id = ?',
      )
      .get(id) as
      | { id: number; cycle_months: number; cycle_days: number | null }
      | undefined
    if (!snapshot) throw new HttpError(404, '比价记录不存在')

    // 报价挂在哪个套餐上是固定的，编辑只改报价信息。
    const quote = readQuote(req.body ?? {}, {
      cycleMonths: snapshot.cycle_months,
      cycleDays: snapshot.cycle_days,
    })
    db.prepare(
      `UPDATE price_snapshots
       SET captured_at = ?, duration_days = ?, price = ?, cycle_months = ?,
           cycle_days = ?, platform = ?, note = ?
       WHERE id = ?`,
    ).run(
      quote.capturedAt,
      quote.durationDays,
      quote.price,
      quote.cycleMonths,
      quote.cycleDays,
      quote.platform,
      quote.note,
      id,
    )

    res.json(buildState())
  }),
)

apiRouter.delete(
  '/snapshots/:id',
  route((req, res) => {
    const id = idParam(req.params.id, '比价记录')
    const info = db.prepare('DELETE FROM price_snapshots WHERE id = ?').run(id)
    if (info.changes === 0) throw new HttpError(404, '比价记录不存在')
    res.json(buildState())
  }),
)

apiRouter.post(
  '/joint-quotes',
  route((req, res) => {
    const body = req.body ?? {}
    const capturedAt = date(body.capturedAt, '记录日期')
    const total = integer(body.total, '整条报价', 0, 1_000_000_000_000)
    const mode = costMode(body.costMode)
    const platform = text(body.platform, '平台', 60)
    const note = optionalText(body.note, 300)

    const items = parseMembers(body.items, '报价会员')
    if (items.length < 2) {
      throw new HttpError(400, '联合报价至少需要两个会员')
    }

    const mainSubscriptionId = integer(body.mainSubscriptionId, '费用归属会员', 1)
    if (!items.some((item) => item.subscriptionId === mainSubscriptionId)) {
      throw new HttpError(400, '费用归属会员必须在报价会员中')
    }

    const exists = db.prepare('SELECT id FROM subscriptions WHERE id = ?')
    for (const item of items) {
      if (!exists.get(item.subscriptionId)) {
        throw new HttpError(404, '会员记录不存在')
      }
    }

    const bundleMonths = Math.max(
      ...items.map((item) => Math.round(item.days / DAYS_PER_MONTH)),
      0,
    )

    db.transaction(() => {
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
          bundleMonths,
          mainSubscriptionId,
          mode,
          platform,
          note,
          nowISO(),
        )
      const quoteId = Number(info.lastInsertRowid)
      const insertItem = db.prepare(
        `INSERT INTO joint_quote_items
          (joint_quote_id, subscription_id, duration_days)
         VALUES (?, ?, ?)`,
      )
      for (const item of items) {
        insertItem.run(quoteId, item.subscriptionId, item.days)
      }
    })()

    res.status(201).json(buildState())
  }),
)

apiRouter.put(
  '/joint-quotes/:id',
  route((req, res) => {
    const id = idParam(req.params.id, '联合报价')
    const quote = db
      .prepare('SELECT id FROM joint_quotes WHERE id = ?')
      .get(id) as { id: number } | undefined
    if (!quote) throw new HttpError(404, '联合报价不存在')

    const existingItems = db
      .prepare(
        `SELECT subscription_id, duration_days
         FROM joint_quote_items
         WHERE joint_quote_id = ?
         ORDER BY id`,
      )
      .all(id) as { subscription_id: number; duration_days: number | null }[]
    const memberIds = new Set(existingItems.map((item) => item.subscription_id))

    const body = req.body ?? {}
    const capturedAt = date(body.capturedAt, '记录日期')
    const total = integer(body.total, '整条报价', 0, 1_000_000_000_000)
    const mode = costMode(body.costMode)
    const platform = text(body.platform, '平台', 60)
    const note = optionalText(body.note, 300)
    const mainSubscriptionId = integer(body.mainSubscriptionId, '费用归属会员', 1)
    if (!memberIds.has(mainSubscriptionId)) {
      throw new HttpError(400, '费用归属会员必须在报价会员中')
    }

    // 编辑可以调整已有会员的时长，但不能通过新增或删除成员改变套餐组合。
    let items: JointMemberInput[] | null = null
    if (body.items !== undefined) {
      items = parseMembers(body.items, '报价会员')
      const sameMembers =
        items.length === existingItems.length &&
        items.every((item) => memberIds.has(item.subscriptionId))
      if (!sameMembers) {
        throw new HttpError(400, '编辑时不能添加或删除联合报价会员')
      }
    }

    const durations = items
      ? items.map((item) => item.days)
      : existingItems.map((item) => item.duration_days ?? 0)
    const bundleMonths = Math.max(
      ...durations.map((days) => Math.round(days / DAYS_PER_MONTH)),
      0,
    )

    db.transaction(() => {
      db.prepare(
        `UPDATE joint_quotes
         SET captured_at = ?, total = ?, cycle_months = ?, main_subscription_id = ?,
             cost_mode = ?, platform = ?, note = ?
         WHERE id = ?`,
      ).run(
        capturedAt,
        total,
        bundleMonths,
        mainSubscriptionId,
        mode,
        platform,
        note,
        id,
      )

      if (items) {
        const updateDuration = db.prepare(
          `UPDATE joint_quote_items
           SET duration_days = ?
           WHERE joint_quote_id = ? AND subscription_id = ?`,
        )
        for (const item of items) {
          updateDuration.run(item.days, id, item.subscriptionId)
        }
      }
    })()

    res.json(buildState())
  }),
)

apiRouter.delete(
  '/joint-quotes/:id',
  route((req, res) => {
    const id = idParam(req.params.id, '联合报价')
    const info = db.prepare('DELETE FROM joint_quotes WHERE id = ?').run(id)
    if (info.changes === 0) throw new HttpError(404, '联合报价不存在')
    res.json(buildState())
  }),
)

apiRouter.post(
  '/seed',
  route((_req, res) => {
    seedDemoData()
    res.status(201).json(buildState())
  }),
)

apiRouter.delete(
  '/data',
  route((req, res) => {
    if (req.body?.confirm !== 'DELETE') {
      throw new HttpError(400, '需要确认参数')
    }
    // 清空是不可逆操作，先留一份完整快照，万一误点还能从 data/backups 找回。
    const backupDir = path.join(path.dirname(dbPath), 'backups')
    fs.mkdirSync(backupDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    db.prepare('VACUUM INTO ?').run(path.join(backupDir, `app-${stamp}.db`))
    db.transaction(() => {
      db.prepare('DELETE FROM joint_quote_items').run()
      db.prepare('DELETE FROM joint_quotes').run()
      db.prepare('DELETE FROM price_snapshots').run()
      db.prepare('DELETE FROM payments').run()
      db.prepare('DELETE FROM joint_renewals').run()
      db.prepare('DELETE FROM subscriptions').run()
      db.prepare('DELETE FROM plans').run()
      db.prepare('DELETE FROM services').run()
      db.prepare(
        `DELETE FROM sqlite_sequence WHERE name IN
          ('joint_quote_items', 'joint_quotes', 'price_snapshots', 'payments',
           'joint_renewals', 'subscriptions', 'plans', 'services')`,
      ).run()
    })()
    res.json(buildState())
  }),
)

apiRouter.get(
  '/export/json',
  route((_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="subledger-${todayISO()}.json"`,
    )
    res.send(JSON.stringify(exportAll(), null, 2))
  }),
)

apiRouter.post(
  '/import/json',
  route((req, res) => {
    const imported = importAll(req.body)
    res.json({ ...buildState(), imported })
  }),
)
