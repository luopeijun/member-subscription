import { db } from './db'
import { HttpError } from './errors'
import { isISODate, nowISO } from './util'

export type ImportSummary = {
  servicesAdded: number
  plansAdded: number
  subscriptionsAdded: number
  paymentsAdded: number
  snapshotsAdded: number
}

function asArray(value: unknown, label: string): Record<string, unknown>[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    throw new HttpError(400, `${label} 格式不正确`)
  }
  return value as Record<string, unknown>[]
}

function requiredText(value: unknown, label: string, max = 120): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `${label}缺失`)
  }
  return value.trim().slice(0, max)
}

function optionalText(value: unknown, max = 300): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed || null
}

function integer(value: unknown, label: string, min = 0, max = 1_000_000_000_000): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new HttpError(400, `${label}格式不正确`)
  }
  return value
}

function date(value: unknown, label: string): string {
  if (typeof value !== 'string' || !isISODate(value)) {
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

function nullableDate(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === '') return null
  return date(value, label)
}

function createdStamp(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : nowISO()
}

function normalizeStatus(value: unknown): string {
  if (value === 'expired' || value === 'paused' || value === 'cancelled') return 'expired'
  return 'active'
}

const CYCLE_MONTHS = new Set([0, 1, 3, 6, 12])

function normalizeCycle(value: unknown): number {
  const months = integer(value, '套餐周期', 0, 120)
  return CYCLE_MONTHS.has(months) ? months : 12
}

export function exportAll() {
  return {
    app: 'subledger',
    version: 1,
    exportedAt: new Date().toISOString(),
    services: db
      .prepare('SELECT id, name, category, created_at FROM services ORDER BY id')
      .all(),
    plans: db
      .prepare(
        'SELECT id, service_id, name, cycle_months, list_price, note, created_at FROM plans ORDER BY id',
      )
      .all(),
    subscriptions: db
      .prepare(
        `SELECT id, plan_id, platform, account, started_at, next_renewal_override,
          auto_renew, status, shared_with, note, joint_parent_id, joint_cost_mode, created_at
         FROM subscriptions ORDER BY id`,
      )
      .all(),
    payments: db
      .prepare(
        `SELECT id, subscription_id, paid_at, amount, note, joint_purchase_id, created_at
         FROM payments ORDER BY id`,
      )
      .all(),
    snapshots: db
      .prepare(
        `SELECT id, plan_id, captured_at, price, cycle_months, platform, note, created_at
         FROM price_snapshots ORDER BY id`,
      )
      .all(),
  }
}

export function importAll(payload: unknown): ImportSummary {
  if (!payload || typeof payload !== 'object') {
    throw new HttpError(400, '导入文件内容为空')
  }

  const root = payload as Record<string, unknown>
  if (root.app !== undefined && root.app !== 'subledger') {
    throw new HttpError(400, '这不是会员订阅的备份文件')
  }

  const services = asArray(root.services, '服务列表')
  const plans = asArray(root.plans, '套餐列表')
  const subscriptions = asArray(root.subscriptions, '会员列表')
  const payments = asArray(root.payments, '支付列表')
  const snapshots = asArray(root.snapshots, '比价列表')

  const summary: ImportSummary = {
    servicesAdded: 0,
    plansAdded: 0,
    subscriptionsAdded: 0,
    paymentsAdded: 0,
    snapshotsAdded: 0,
  }

  const run = db.transaction(() => {
    const serviceMap = new Map<number, number>()
    const planMap = new Map<number, number>()
    const planCycleMap = new Map<number, number>()
    const subscriptionMap = new Map<number, number>()

    const findService = db.prepare('SELECT id FROM services WHERE name = ? COLLATE NOCASE')
    const insertService = db.prepare(
      'INSERT INTO services (name, category, created_at) VALUES (?, ?, ?)',
    )
    const findPlan = db.prepare(
      `SELECT id FROM plans
       WHERE service_id = ? AND name = ? COLLATE NOCASE AND cycle_months = ?`,
    )
    const insertPlan = db.prepare(
      `INSERT INTO plans (service_id, name, cycle_months, list_price, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    const insertSubscription = db.prepare(
      `INSERT INTO subscriptions
        (plan_id, platform, account, started_at, next_renewal_override,
         auto_renew, status, shared_with, note, joint_cost_mode, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const insertPayment = db.prepare(
      `INSERT INTO payments (subscription_id, paid_at, amount, note, joint_purchase_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    const insertSnapshot = db.prepare(
      `INSERT INTO price_snapshots (plan_id, captured_at, price, cycle_months, platform, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )

    for (const row of services) {
      const oldId = integer(row.id, '服务 id', 1)
      const name = requiredText(row.name, '服务名称', 80)
      const category = optionalText(row.category, 30) ?? '其他'
      const existing = findService.get(name) as { id: number } | undefined

      if (existing) {
        serviceMap.set(oldId, existing.id)
      } else {
        const info = insertService.run(name, category, createdStamp(row.created_at))
        serviceMap.set(oldId, Number(info.lastInsertRowid))
        summary.servicesAdded += 1
      }
    }

    for (const row of plans) {
      const oldId = integer(row.id, '套餐 id', 1)
      const serviceId = serviceMap.get(integer(row.service_id, '套餐所属服务', 1))
      if (!serviceId) {
        throw new HttpError(400, '套餐引用了不存在的服务')
      }
      const name = requiredText(row.name, '套餐名称', 80)
      const cycleMonths = normalizeCycle(row.cycle_months)
      const listPrice = integer(row.list_price ?? 0, '套餐标价', 0)
      const note = optionalText(row.note)
      const existing = findPlan.get(serviceId, name, cycleMonths) as
        | { id: number }
        | undefined

      if (existing) {
        planMap.set(oldId, existing.id)
      } else {
        const info = insertPlan.run(
          serviceId,
          name,
          cycleMonths,
          listPrice,
          note,
          createdStamp(row.created_at),
        )
        planMap.set(oldId, Number(info.lastInsertRowid))
        summary.plansAdded += 1
      }
      planCycleMap.set(oldId, cycleMonths)
    }

    for (const row of subscriptions) {
      const oldId = integer(row.id, '会员 id', 1)
      const planId = planMap.get(integer(row.plan_id, '会员所属套餐', 1))
      if (!planId) {
        throw new HttpError(400, '会员引用了不存在的套餐')
      }
      const autoRenew =
        row.auto_renew === true || row.auto_renew === 1 || row.auto_renew === '1' ? 1 : 0
      const jointCostMode = row.joint_cost_mode === 'main' ? 'main' : 'split'
      const info = insertSubscription.run(
        planId,
        optionalText(row.platform, 60),
        optionalText(row.account, 120),
        date(row.started_at, '会员开始日期'),
        nullableDate(row.next_renewal_override, '下次续费日期'),
        autoRenew,
        normalizeStatus(row.status),
        optionalText(row.shared_with, 120),
        optionalText(row.note),
        jointCostMode,
        createdStamp(row.created_at),
      )
      subscriptionMap.set(oldId, Number(info.lastInsertRowid))
      summary.subscriptionsAdded += 1
    }

    const setJointParent = db.prepare(
      'UPDATE subscriptions SET joint_parent_id = ? WHERE id = ?',
    )
    for (const row of subscriptions) {
      if (row.joint_parent_id === null || row.joint_parent_id === undefined) continue
      const childId = subscriptionMap.get(integer(row.id, '会员 id', 1))
      const parentId = subscriptionMap.get(
        integer(row.joint_parent_id, '联合会员主记录', 1),
      )
      if (!childId || !parentId) {
        throw new HttpError(400, '联合会员引用了不存在的会员')
      }
      if (childId === parentId) continue
      setJointParent.run(parentId, childId)
    }

    for (const row of payments) {
      const subscriptionId = subscriptionMap.get(
        integer(row.subscription_id, '支付所属会员', 1),
      )
      if (!subscriptionId) {
        throw new HttpError(400, '支付记录引用了不存在的会员')
      }
      insertPayment.run(
        subscriptionId,
        date(row.paid_at, '支付日期'),
        integer(row.amount, '支付金额', 0),
        optionalText(row.note),
        optionalText(row.joint_purchase_id, 80),
        createdStamp(row.created_at),
      )
      summary.paymentsAdded += 1
    }

    for (const row of snapshots) {
      const oldPlanId = integer(row.plan_id, '报价所属套餐', 1)
      const planId = planMap.get(oldPlanId)
      if (!planId) {
        throw new HttpError(400, '报价引用了不存在的套餐')
      }
      const cycleMonths = normalizeCycle(
        row.cycle_months ?? planCycleMap.get(oldPlanId) ?? 12,
      )
      insertSnapshot.run(
        planId,
        date(row.captured_at, '报价日期'),
        integer(row.price, '报价价格', 0),
        cycleMonths,
        optionalText(row.platform, 60),
        optionalText(row.note),
        createdStamp(row.created_at),
      )
      summary.snapshotsAdded += 1
    }
  })

  run()
  return summary
}
