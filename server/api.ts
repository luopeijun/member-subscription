import { Router, type Request, type Response } from 'express'
import { db } from './db'
import { HttpError } from './errors'
import { buildState } from './store'
import { seedDemoData } from './seed'
import { addMonths, isISODate, nowISO, todayISO } from './util'
import { exportAll, importAll } from './transfer'

const STATUSES = new Set(['active', 'expired'])

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

function text(value: unknown, label: string, max = 120): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `请填写${label}`)
  }
  return value.trim().slice(0, max)
}

function optionalText(value: unknown, max = 300): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed || null
}

function integer(
  value: unknown,
  label: string,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new HttpError(400, `${label}必须是整数`)
  }
  if (parsed < min || parsed > max) {
    throw new HttpError(400, `${label}超出允许范围`)
  }
  return parsed
}

function date(value: unknown, label: string): string {
  if (!isISODate(value)) {
    throw new HttpError(400, `${label}格式应为 YYYY-MM-DD`)
  }
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new HttpError(400, `${label}不是有效日期`)
  }
  return value
}

function maybeDate(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === '') return null
  return date(value, label)
}

function status(value: unknown): string {
  if (typeof value !== 'string' || !STATUSES.has(value)) {
    throw new HttpError(400, '状态不正确')
  }
  return value
}

const CYCLE_MONTHS = new Set([0, 1, 3, 6, 12])

function cycle(value: unknown): number {
  const months = integer(value, '周期', 0, 120)
  if (!CYCLE_MONTHS.has(months)) {
    throw new HttpError(400, '计费周期只能是月付、季付、半年付、年付或一次性')
  }
  return months
}

function idParam(value: string, label: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `${label}不存在`)
  }
  return parsed
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
  listPrice: number
  note: string | null
}

function upsertPlan(serviceId: number, input: PlanInput): number {
  const existing = db
    .prepare(
      `SELECT id FROM plans
       WHERE service_id = ? AND name = ? COLLATE NOCASE AND cycle_months = ?`,
    )
    .get(serviceId, input.name, input.cycleMonths) as { id: number } | undefined

  if (existing) {
    db.prepare(
      'UPDATE plans SET list_price = ?, note = COALESCE(?, note) WHERE id = ?',
    ).run(input.listPrice, input.note, existing.id)
    return existing.id
  }

  const info = db
    .prepare(
      `INSERT INTO plans (service_id, name, cycle_months, list_price, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      serviceId,
      input.name,
      input.cycleMonths,
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
        shared_with: string | null
        note: string | null
      }
    | undefined
  if (!sub) throw new HttpError(404, '会员记录不存在')
  return sub
}

function insertPayment(subscriptionId: number, body: Record<string, unknown>) {
  const paidAt = date(body.paidAt, '支付日期')
  const amount = integer(body.amount, '支付金额', 0, 1_000_000_000_000)

  const info = db
    .prepare(
      `INSERT INTO payments (subscription_id, paid_at, amount, note, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(subscriptionId, paidAt, amount, optionalText(body.note, 300), nowISO())

  return { id: Number(info.lastInsertRowid), amount }
}

type JointCostMode = 'split' | 'main'

function costMode(value: unknown): JointCostMode {
  if (value === 'split' || value === 'main') return value
  throw new HttpError(400, '费用归属不正确')
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
    const cycleMonths = cycle(body.cycleMonths)
    const listPrice = integer(body.listPrice ?? 0, '标价', 0, 1_000_000_000_000)
    const platform = optionalText(body.platform, 60)
    const account = optionalText(body.account, 120)
    const startedAt = date(body.startedAt, '开始日期')
    const subscriptionStatus = status(body.status ?? 'active')
    const sharedWith = optionalText(body.sharedWith, 120)
    const note = optionalText(body.note, 300)
    const autoRenew = body.autoRenew === true

    const payment = (body.payment ?? {}) as Record<string, unknown>

    const transaction = db.transaction(() => {
      const serviceId = upsertService(serviceName, category)
      const planId = upsertPlan(serviceId, {
        name: planName,
        cycleMonths,
        listPrice,
        note: null,
      })
      const subInfo = db
        .prepare(
          `INSERT INTO subscriptions
            (plan_id, platform, account, started_at, next_renewal_override, auto_renew, status, shared_with, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          planId,
          platform,
          account,
          startedAt,
          null,
          autoRenew ? 1 : 0,
          subscriptionStatus,
          sharedWith,
          note,
          nowISO(),
        )
      const subscriptionId = Number(subInfo.lastInsertRowid)
      insertPayment(subscriptionId, payment)
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
          list_price: number
        }
      | undefined
    if (!planRow) throw new HttpError(404, '套餐不存在')

    const category = text(body.category ?? '其他', '类别', 30)
    const planName = text(body.planName ?? planRow.name, '套餐名称', 80)
    const cycleMonths = cycle(body.cycleMonths ?? planRow.cycle_months)
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
         SET name = ?, cycle_months = ?, list_price = ?
         WHERE id = ?`,
      ).run(planName, cycleMonths, listPrice, planRow.id)
      db.prepare(
        `UPDATE subscriptions
         SET platform = ?, account = ?, started_at = ?, next_renewal_override = ?, auto_renew = ?, status = ?, shared_with = ?, note = ?
         WHERE id = ?`,
      ).run(
        optionalText(body.platform, 60),
        optionalText(body.account, 120),
        startedAt,
        nextRenewalOverride,
        autoRenew ? 1 : 0,
        subscriptionStatus,
        optionalText(body.sharedWith, 120),
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
}

apiRouter.post(
  '/joint-renewals',
  route((req, res) => {
    const body = req.body ?? {}
    const total = integer(body.total, '总金额', 0, 1_000_000_000_000)
    const paidAt = date(body.paidAt, '支付日期')
    const months = cycle(body.cycleMonths)
    if (months === 0) {
      throw new HttpError(400, '联合续费周期必须大于 0')
    }
    const mode = costMode(body.costMode)
    const note = optionalText(body.note, 300)

    if (!Array.isArray(body.memberIds)) {
      throw new HttpError(400, '参与会员格式不正确')
    }
    const rawMemberIds = body.memberIds as unknown[]
    const memberIds = [
      ...new Set(rawMemberIds.map((value) => integer(value, '参与会员', 1))),
    ]
    if (memberIds.length < 2) {
      throw new HttpError(400, '联合续费至少需要两个会员')
    }

    const mainSubscriptionId = integer(body.mainSubscriptionId, '费用归属会员', 1)
    if (!memberIds.includes(mainSubscriptionId)) {
      throw new HttpError(400, '费用归属会员必须在参与会员中')
    }

    const share = Math.floor(total / memberIds.length)
    const remainder = total - share * memberIds.length

    const memberStmt = db.prepare(
      `SELECT s.id, s.started_at, s.next_renewal_override, s.status,
              p.cycle_months AS plan_cycle
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
        (subscription_id, paid_at, amount, note, joint_renewal_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    const update = db.prepare(
      'UPDATE subscriptions SET next_renewal_override = ?, status = ? WHERE id = ?',
    )

    db.transaction(() => {
      const prepared = memberIds.map((memberId) => {
        const member = memberStmt.get(memberId) as JointMemberRow | undefined
        if (!member) throw new HttpError(404, '会员记录不存在')
        const last = lastPaymentStmt.get(memberId) as { paid_at: string } | undefined
        const currentNext =
          member.next_renewal_override ||
          addMonths(last?.paid_at ?? member.started_at, member.plan_cycle)
        return { member, nextDate: addMonths(currentNext, months) }
      })

      const jointInfo = insertJoint.run(
        mainSubscriptionId,
        paidAt,
        total,
        months,
        mode,
        note,
        nowISO(),
      )
      const jointRenewalId = Number(jointInfo.lastInsertRowid)

      for (const item of prepared) {
        const isMain = item.member.id === mainSubscriptionId
        const amount =
          mode === 'main' ? (isMain ? total : 0) : share + (isMain ? remainder : 0)
        insertPayment.run(
          item.member.id,
          paidAt,
          amount,
          note,
          jointRenewalId,
          nowISO(),
        )
        const nextStatus =
          item.nextDate >= todayISO() ? 'active' : item.member.status
        update.run(item.nextDate, nextStatus, item.member.id)
      }
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
    insertPayment(id, req.body ?? {})
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
    const cycleMonths = cycle(body.cycleMonths)
    const listPrice = integer(body.listPrice ?? 0, '标价', 0, 1_000_000_000_000)
    const note = optionalText(body.note, 300)

    db.transaction(() => {
      const serviceId = upsertService(serviceName, category)
      upsertPlan(serviceId, {
        name: planName,
        cycleMonths,
        listPrice,
        note,
      })
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
      .prepare('SELECT id, cycle_months FROM plans WHERE id = ?')
      .get(planId) as { id: number; cycle_months: number } | undefined
    if (!plan) throw new HttpError(404, '套餐不存在')

    const capturedAt = date(body.capturedAt, '记录日期')
    const price = integer(body.price, '价格', 0, 1_000_000_000_000)
    const cycleMonths =
      body.cycleMonths === undefined ? plan.cycle_months : cycle(body.cycleMonths)
    const platform = text(body.platform, '平台', 60)
    const note = optionalText(body.note, 300)

    db.prepare(
      `INSERT INTO price_snapshots (plan_id, captured_at, price, cycle_months, platform, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(planId, capturedAt, price, cycleMonths, platform, note, nowISO())

    res.status(201).json(buildState())
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
    const cycleMonths = cycle(body.cycleMonths)
    const platform = text(body.platform, '平台', 60)
    const note = optionalText(body.note, 300)

    if (!Array.isArray(body.subscriptionIds)) {
      throw new HttpError(400, '参与会员格式不正确')
    }
    const rawIds = body.subscriptionIds as unknown[]
    const subscriptionIds = [
      ...new Set(rawIds.map((value) => integer(value, '参与会员', 1))),
    ]
    if (subscriptionIds.length < 2) {
      throw new HttpError(400, '联合报价至少需要两个会员')
    }

    const exists = db.prepare('SELECT id FROM subscriptions WHERE id = ?')
    for (const id of subscriptionIds) {
      if (!exists.get(id)) throw new HttpError(404, '会员记录不存在')
    }

    db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO joint_quotes (captured_at, total, cycle_months, platform, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(capturedAt, total, cycleMonths, platform, note, nowISO())
      const quoteId = Number(info.lastInsertRowid)
      const insertItem = db.prepare(
        'INSERT INTO joint_quote_items (joint_quote_id, subscription_id) VALUES (?, ?)',
      )
      for (const id of subscriptionIds) insertItem.run(quoteId, id)
    })()

    res.status(201).json(buildState())
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
