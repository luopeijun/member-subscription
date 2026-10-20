import { db } from './db'
import { HttpError } from './errors'
import { daysBetween, isISODate, nowISO } from './util'
import { MAX_DURATION_DAYS } from '../shared/duration'

export type ImportSummary = {
  servicesAdded: number
  plansAdded: number
  subscriptionsAdded: number
  jointRenewalsAdded: number
  jointQuotesAdded: number
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

function optionalDurationDays(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  return integer(value, '报价总时长（天）', 1, MAX_DURATION_DAYS)
}

function createdStamp(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : nowISO()
}

function normalizeStatus(value: unknown): string {
  if (value === 'planned') return 'planned'
  if (value === 'expired' || value === 'paused' || value === 'cancelled') return 'expired'
  return 'active'
}

const CYCLE_MONTHS = new Set([-1, 0, 1, 3, 6, 12, 24])

function normalizeCycle(value: unknown): number {
  const months = integer(value, '套餐周期', -1, 120)
  return CYCLE_MONTHS.has(months) ? months : 12
}

function normalizeCycleDays(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  return integer(value, '套餐周期天数', 1, 3650)
}

function normalizeCyclePair(
  monthsValue: unknown,
  daysValue: unknown,
): { cycleMonths: number; cycleDays: number | null } {
  const cycleDays = normalizeCycleDays(daysValue)
  if (cycleDays !== null) return { cycleMonths: 0, cycleDays }
  return { cycleMonths: normalizeCycle(monthsValue), cycleDays: null }
}

export function exportAll() {
  const jointQuoteRows = db
    .prepare(
      `SELECT id, captured_at, total, cycle_months, main_subscription_id,
        cost_mode, platform, note, created_at
       FROM joint_quotes ORDER BY id`,
    )
    .all() as { id: number }[]
  const jointQuoteItemRows = db
    .prepare(
      `SELECT joint_quote_id, subscription_id, duration_days
       FROM joint_quote_items ORDER BY id`,
    )
    .all() as {
    joint_quote_id: number
    subscription_id: number
    duration_days: number | null
  }[]
  const jointQuoteItemsByQuote = new Map<number, typeof jointQuoteItemRows>()
  for (const item of jointQuoteItemRows) {
    const list = jointQuoteItemsByQuote.get(item.joint_quote_id) ?? []
    list.push(item)
    jointQuoteItemsByQuote.set(item.joint_quote_id, list)
  }

  return {
    app: 'subledger',
    version: 1,
    exportedAt: new Date().toISOString(),
    services: db
      .prepare('SELECT id, name, category, created_at FROM services ORDER BY id')
      .all(),
    plans: db
      .prepare(
        'SELECT id, service_id, name, cycle_months, cycle_days, list_price, note, created_at FROM plans ORDER BY id',
      )
      .all(),
    subscriptions: db
      .prepare(
        `SELECT id, plan_id, platform, account, started_at, next_renewal_override,
          auto_renew, status, note, created_at
         FROM subscriptions ORDER BY id`,
      )
      .all(),
    jointRenewals: db
      .prepare(
        `SELECT id, main_subscription_id, paid_at, total, cycle_months,
          cost_mode, note, created_at
         FROM joint_renewals ORDER BY id`,
      )
      .all(),
    payments: db
      .prepare(
        `SELECT id, subscription_id, paid_at, amount, note, joint_renewal_id,
          duration_days, created_at
         FROM payments ORDER BY id`,
      )
      .all(),
    snapshots: db
      .prepare(
        `SELECT id, plan_id, captured_at, duration_days, price, cycle_months, cycle_days,
          platform, note, created_at
         FROM price_snapshots ORDER BY id`,
      )
      .all(),
    jointQuotes: jointQuoteRows.map((quote) => ({
      ...quote,
      items: (jointQuoteItemsByQuote.get(quote.id) ?? []).map((item) => ({
        subscription_id: item.subscription_id,
        duration_days: item.duration_days,
      })),
    })),
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
  const jointRenewals = asArray(
    root.jointRenewals ?? root.joint_renewals,
    '联合续费列表',
  )
  const payments = asArray(root.payments, '支付列表')
  const snapshots = asArray(root.snapshots, '比价列表')
  const jointQuotes = asArray(
    root.jointQuotes ?? root.joint_quotes,
    '联合报价列表',
  )

  const summary: ImportSummary = {
    servicesAdded: 0,
    plansAdded: 0,
    subscriptionsAdded: 0,
    jointRenewalsAdded: 0,
    jointQuotesAdded: 0,
    paymentsAdded: 0,
    snapshotsAdded: 0,
  }

  const run = db.transaction(() => {
    const serviceMap = new Map<number, number>()
    const planMap = new Map<number, number>()
    const planCycleMap = new Map<
      number,
      { cycleMonths: number; cycleDays: number | null }
    >()
    const subscriptionMap = new Map<number, number>()

    const findService = db.prepare('SELECT id FROM services WHERE name = ? COLLATE NOCASE')
    const insertService = db.prepare(
      'INSERT INTO services (name, category, created_at) VALUES (?, ?, ?)',
    )
    const findPlan = db.prepare(
      `SELECT id FROM plans
       WHERE service_id = ? AND name = ? COLLATE NOCASE AND cycle_months = ?
         AND IFNULL(cycle_days, -1) = IFNULL(?, -1)`,
    )
    const insertPlan = db.prepare(
      `INSERT INTO plans
        (service_id, name, cycle_months, cycle_days, list_price, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    const insertSubscription = db.prepare(
      `INSERT INTO subscriptions
        (plan_id, platform, account, started_at, next_renewal_override,
         auto_renew, status, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const insertJointRenewal = db.prepare(
      `INSERT INTO joint_renewals
        (main_subscription_id, paid_at, total, cycle_months, cost_mode, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    const insertPayment = db.prepare(
      `INSERT INTO payments
        (subscription_id, paid_at, amount, note, joint_renewal_id,
         duration_days, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    const insertSnapshot = db.prepare(
      `INSERT INTO price_snapshots
        (plan_id, captured_at, duration_days, price, cycle_months, cycle_days, platform, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const insertJointQuote = db.prepare(
      `INSERT INTO joint_quotes
        (captured_at, total, cycle_months, main_subscription_id, cost_mode,
         platform, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const insertJointQuoteItem = db.prepare(
      `INSERT INTO joint_quote_items
        (joint_quote_id, subscription_id, duration_days)
       VALUES (?, ?, ?)`,
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
      const cycle = normalizeCyclePair(row.cycle_months, row.cycle_days)
      const listPrice = integer(row.list_price ?? 0, '套餐标价', 0)
      const note = optionalText(row.note)
      const existing = findPlan.get(
        serviceId,
        name,
        cycle.cycleMonths,
        cycle.cycleDays,
      ) as { id: number } | undefined

      if (existing) {
        planMap.set(oldId, existing.id)
      } else {
        const info = insertPlan.run(
          serviceId,
          name,
          cycle.cycleMonths,
          cycle.cycleDays,
          listPrice,
          note,
          createdStamp(row.created_at),
        )
        planMap.set(oldId, Number(info.lastInsertRowid))
        summary.plansAdded += 1
      }
      planCycleMap.set(oldId, cycle)
    }

    for (const row of subscriptions) {
      const oldId = integer(row.id, '会员 id', 1)
      const planId = planMap.get(integer(row.plan_id, '会员所属套餐', 1))
      if (!planId) {
        throw new HttpError(400, '会员引用了不存在的套餐')
      }
      const autoRenew =
        row.auto_renew === true || row.auto_renew === 1 || row.auto_renew === '1' ? 1 : 0
      // 旧备份把合租信息存在单独字段里，导入时并入备注。
      const noteParts = [optionalText(row.note), optionalText(row.shared_with, 120)].filter(
        (part): part is string => Boolean(part),
      )
      const info = insertSubscription.run(
        planId,
        optionalText(row.platform, 60),
        optionalText(row.account, 120),
        date(row.started_at, '会员开始日期'),
        nullableDate(row.next_renewal_override, '下次续费日期'),
        autoRenew,
        normalizeStatus(row.status),
        noteParts.length > 0 ? noteParts.join(' · ') : null,
        createdStamp(row.created_at),
      )
      subscriptionMap.set(oldId, Number(info.lastInsertRowid))
      summary.subscriptionsAdded += 1
    }

    const jointRenewalMap = new Map<number, number>()
    for (const row of jointRenewals) {
      const oldId = integer(row.id, '联合续费 id', 1)
      const rawMainId = row.main_subscription_id
      let mainSubscriptionId: number | null = null
      if (rawMainId !== null && rawMainId !== undefined) {
        mainSubscriptionId =
          subscriptionMap.get(integer(rawMainId, '联合续费主会员', 1)) ?? null
      }
      const cycleMonths = normalizeCycle(row.cycle_months ?? 12) || 12
      const info = insertJointRenewal.run(
        mainSubscriptionId,
        date(row.paid_at, '联合续费日期'),
        integer(row.total, '联合续费总额', 0),
        cycleMonths,
        row.cost_mode === 'main' ? 'main' : 'split',
        optionalText(row.note),
        createdStamp(row.created_at),
      )
      jointRenewalMap.set(oldId, Number(info.lastInsertRowid))
      summary.jointRenewalsAdded += 1
    }

    for (const row of jointQuotes) {
      const rawItems = Array.isArray(row.items)
        ? (row.items as Record<string, unknown>[])
        : []
      const items: { subscriptionId: number; days: number | null }[] = []
      const seen = new Set<number>()
      for (const item of rawItems) {
        const subscriptionId = subscriptionMap.get(
          integer(item.subscription_id, '联合报价会员', 1),
        )
        if (!subscriptionId || seen.has(subscriptionId)) continue
        seen.add(subscriptionId)
        const days =
          item.duration_days === null || item.duration_days === undefined
            ? null
            : integer(item.duration_days, '联合报价时长（天）', 1, 3650)
        items.push({ subscriptionId, days })
      }
      if (items.length === 0) continue

      const rawMainId = row.main_subscription_id
      const importedMainId =
        rawMainId === null || rawMainId === undefined
          ? null
          : (subscriptionMap.get(integer(rawMainId, '联合报价主会员', 1)) ?? null)
      const mainSubscriptionId =
        importedMainId !== null &&
        items.some((item) => item.subscriptionId === importedMainId)
          ? importedMainId
          : (items[0]?.subscriptionId ?? null)

      const info = insertJointQuote.run(
        date(row.captured_at, '联合报价日期'),
        integer(row.total, '联合报价总额', 0),
        normalizeCycle(row.cycle_months ?? 0),
        mainSubscriptionId,
        row.cost_mode === 'main' ? 'main' : 'split',
        optionalText(row.platform, 60),
        optionalText(row.note),
        createdStamp(row.created_at),
      )
      const quoteId = Number(info.lastInsertRowid)
      for (const item of items) {
        insertJointQuoteItem.run(quoteId, item.subscriptionId, item.days)
      }
      summary.jointQuotesAdded += 1
    }

    for (const row of payments) {
      const subscriptionId = subscriptionMap.get(
        integer(row.subscription_id, '支付所属会员', 1),
      )
      if (!subscriptionId) {
        throw new HttpError(400, '支付记录引用了不存在的会员')
      }
      const rawJointRenewalId = row.joint_renewal_id
      let jointRenewalId: number | null = null
      if (rawJointRenewalId !== null && rawJointRenewalId !== undefined) {
        jointRenewalId =
          jointRenewalMap.get(integer(rawJointRenewalId, '联合续费记录', 1)) ?? null
      }
      const durationDays =
        row.duration_days === null || row.duration_days === undefined
          ? null
          : integer(row.duration_days, '支付时长（天）', 1, 3650)
      insertPayment.run(
        subscriptionId,
        date(row.paid_at, '支付日期'),
        integer(row.amount, '支付金额', 0),
        optionalText(row.note),
        jointRenewalId,
        durationDays,
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
      const fallbackCycle = planCycleMap.get(oldPlanId) ?? {
        cycleMonths: 12,
        cycleDays: null,
      }
      const cycle = normalizeCyclePair(
        row.cycle_months ?? fallbackCycle.cycleMonths,
        row.cycle_days ?? fallbackCycle.cycleDays,
      )
      const capturedAt = date(row.captured_at, '报价日期')
      let durationDays = optionalDurationDays(row.duration_days)
      if (durationDays === null) {
        // 旧备份用到期日表示这条报价覆盖的时间，换算成总天数。
        const legacyExpiresAt = nullableDate(row.expires_at, '报价到期日')
        if (legacyExpiresAt) {
          const legacyDays = daysBetween(capturedAt, legacyExpiresAt)
          if (legacyDays > 0) {
            durationDays = Math.min(legacyDays, MAX_DURATION_DAYS)
          }
        }
      }
      insertSnapshot.run(
        planId,
        capturedAt,
        durationDays,
        integer(row.price, '报价价格', 0),
        cycle.cycleMonths,
        cycle.cycleDays,
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
