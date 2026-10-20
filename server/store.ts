import { db } from './db'
import { addDays, addMonths, daysBetween, pad2, todayISO } from './util'
import { DAYS_PER_MONTH } from '../shared/duration'

type ServiceRow = {
  id: number
  name: string
  category: string
}

type PlanRow = {
  id: number
  service_id: number
  name: string
  cycle_months: number
  cycle_days: number | null
  list_price: number
  note: string | null
  service_name: string
  category: string
  subscribed: number
}

type SubRow = {
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

type PaymentRow = {
  id: number
  subscription_id: number
  paid_at: string
  amount: number
  note: string | null
  joint_renewal_id: number | null
  duration_days: number | null
  service_name: string
  plan_name: string
  cycle_months: number
}

type JointRenewalRow = {
  id: number
  main_subscription_id: number | null
  paid_at: string
  total: number
  cycle_months: number
  cost_mode: string
  note: string | null
  main_service_name: string | null
}

type JointMemberRow = {
  joint_renewal_id: number
  subscription_id: number
  amount: number
  duration_days: number | null
  service_name: string
  plan_name: string
}

type SnapshotRow = {
  id: number
  plan_id: number
  captured_at: string
  duration_days: number | null
  price: number
  platform: string | null
  note: string | null
  service_name: string
  plan_name: string
  cycle_months: number
  cycle_days: number | null
}

type JointQuoteRow = {
  id: number
  captured_at: string
  total: number
  cycle_months: number
  main_subscription_id: number | null
  cost_mode: string
  platform: string | null
  note: string | null
}

type JointQuoteItemRow = {
  joint_quote_id: number
  subscription_id: number
  duration_days: number | null
  service_name: string
  plan_name: string
  plan_cycle_months: number
  plan_cycle_days: number | null
}

function allocateJointQuoteAmounts(
  total: number,
  durations: number[],
  mode: 'split' | 'main',
  mainIndex: number,
): number[] {
  if (durations.length === 0) return []
  const safeMainIndex =
    mainIndex >= 0 && mainIndex < durations.length ? mainIndex : 0
  if (mode === 'main') {
    return durations.map((_, index) => (index === safeMainIndex ? total : 0))
  }
  const totalDays = durations.reduce((sum, days) => sum + days, 0)
  if (totalDays <= 0) return durations.map(() => 0)
  const amounts = durations.map((days) => Math.floor((total * days) / totalDays))
  const assigned = amounts.reduce((sum, amount) => sum + amount, 0)
  amounts[safeMainIndex] += total - assigned
  return amounts
}

export function buildState() {
  const services = db
    .prepare('SELECT id, name, category FROM services ORDER BY name COLLATE NOCASE')
    .all() as ServiceRow[]

  const planRows = db
    .prepare(
      `SELECT p.id, p.service_id, p.name, p.cycle_months, p.cycle_days, p.list_price, p.note,
        s.name AS service_name, s.category AS category,
        EXISTS(
          SELECT 1 FROM subscriptions sub
          WHERE sub.plan_id = p.id AND sub.status = 'active'
        ) AS subscribed
      FROM plans p
      JOIN services s ON s.id = p.service_id
      ORDER BY s.name COLLATE NOCASE, p.cycle_months, p.name COLLATE NOCASE`,
    )
    .all() as PlanRow[]

  const planById = new Map(planRows.map((plan) => [plan.id, plan]))

  const subRows = db
    .prepare('SELECT * FROM subscriptions ORDER BY id')
    .all() as SubRow[]

  const paymentRows = db
    .prepare(
      `SELECT pay.id, pay.subscription_id, pay.paid_at, pay.amount, pay.note,
        pay.joint_renewal_id, pay.duration_days,
        s.name AS service_name, pl.name AS plan_name, pl.cycle_months
      FROM payments pay
      JOIN subscriptions sub ON sub.id = pay.subscription_id
      JOIN plans pl ON pl.id = sub.plan_id
      JOIN services s ON s.id = pl.service_id
      ORDER BY pay.paid_at, pay.id`,
    )
    .all() as PaymentRow[]

  const jointRenewalRows = db
    .prepare(
      `SELECT jr.id, jr.main_subscription_id, jr.paid_at, jr.total, jr.cycle_months,
        jr.cost_mode, jr.note, s.name AS main_service_name
      FROM joint_renewals jr
      LEFT JOIN subscriptions sub ON sub.id = jr.main_subscription_id
      LEFT JOIN plans pl ON pl.id = sub.plan_id
      LEFT JOIN services s ON s.id = pl.service_id
      ORDER BY jr.paid_at DESC, jr.id DESC`,
    )
    .all() as JointRenewalRow[]

  const jointMemberRows = db
    .prepare(
      `SELECT pay.joint_renewal_id, pay.subscription_id, pay.amount,
        pay.duration_days,
        s.name AS service_name, pl.name AS plan_name
      FROM payments pay
      JOIN subscriptions sub ON sub.id = pay.subscription_id
      JOIN plans pl ON pl.id = sub.plan_id
      JOIN services s ON s.id = pl.service_id
      WHERE pay.joint_renewal_id IS NOT NULL
      ORDER BY pay.id`,
    )
    .all() as JointMemberRow[]

  const jointMembersByRenewal = new Map<number, JointMemberRow[]>()
  for (const member of jointMemberRows) {
    const list = jointMembersByRenewal.get(member.joint_renewal_id) ?? []
    list.push(member)
    jointMembersByRenewal.set(member.joint_renewal_id, list)
  }

  const snapshotRows = db
    .prepare(
      `SELECT ps.id, ps.plan_id, ps.captured_at, ps.duration_days, ps.price, ps.cycle_months, ps.cycle_days, ps.platform, ps.note,
        s.name AS service_name, pl.name AS plan_name
      FROM price_snapshots ps
      JOIN plans pl ON pl.id = ps.plan_id
      JOIN services s ON s.id = pl.service_id
      ORDER BY ps.captured_at DESC, ps.id DESC`,
    )
    .all() as SnapshotRow[]

  const jointQuoteRows = db
    .prepare(
      `SELECT jq.id, jq.captured_at, jq.total, jq.cycle_months,
        jq.main_subscription_id, jq.cost_mode, jq.platform, jq.note
      FROM joint_quotes jq
      ORDER BY jq.captured_at DESC, jq.id DESC`,
    )
    .all() as JointQuoteRow[]

  const jointQuoteItemRows = db
    .prepare(
      `SELECT jqi.joint_quote_id, jqi.subscription_id,
        jqi.duration_days,
        s.name AS service_name, pl.name AS plan_name, pl.cycle_months AS plan_cycle_months,
        pl.cycle_days AS plan_cycle_days
      FROM joint_quote_items jqi
      JOIN subscriptions sub ON sub.id = jqi.subscription_id
      JOIN plans pl ON pl.id = sub.plan_id
      JOIN services s ON s.id = pl.service_id
      ORDER BY jqi.id`,
    )
    .all() as JointQuoteItemRow[]

  const paymentsBySub = new Map<number, PaymentRow[]>()
  for (const payment of paymentRows) {
    const list = paymentsBySub.get(payment.subscription_id) ?? []
    list.push(payment)
    paymentsBySub.set(payment.subscription_id, list)
  }

  const jointQuoteItemsByQuote = new Map<number, JointQuoteItemRow[]>()
  for (const item of jointQuoteItemRows) {
    const list = jointQuoteItemsByQuote.get(item.joint_quote_id) ?? []
    list.push(item)
    jointQuoteItemsByQuote.set(item.joint_quote_id, list)
  }

  const today = todayISO()

  const subscriptions = subRows.map((sub) => {
    const plan = planById.get(sub.plan_id)
    const payments = paymentsBySub.get(sub.id) ?? []
    const last = payments.at(-1) ?? null
    const prev = payments.at(-2) ?? null
    const cycle = plan?.cycle_months ?? 12
    const cycleDays = plan?.cycle_days ?? null

    // 想买还没付款，既没有到期日，也不该按开始日期推算下一次扣款。
    const planned = sub.status === 'planned'
    const baseDate = last?.paid_at ?? sub.started_at
    const computedNext =
      !planned && cycleDays !== null && cycleDays > 0
        ? addDays(baseDate, cycleDays)
        : !planned && cycle > 0
          ? addMonths(baseDate, cycle)
          : null
    const nextRenewalAt = planned ? null : sub.next_renewal_override || computedNext
    const daysLeft = nextRenewalAt ? daysBetween(today, nextRenewalAt) : null
    // 状态跟着日期走：过了到期日就是已过期，续费把日期推后会自然恢复活跃。
    const status = planned
      ? 'planned'
      : nextRenewalAt && nextRenewalAt < today
        ? 'expired'
        : !nextRenewalAt && sub.status === 'expired'
          ? 'expired'
          : 'active'

    // A joint purchase can hand this member a duration that differs from the
    // plan's own cycle (e.g. a 1-month perk on an annual plan), so fall back to
    // the payment's own duration before the plan cycle.
    const effectiveMonths =
      last && last.duration_days !== null
        ? last.duration_days / DAYS_PER_MONTH
        : cycleDays !== null && cycleDays > 0
          ? cycleDays / DAYS_PER_MONTH
          : cycle
    const annualized =
      effectiveMonths > 0 && last
        ? Math.round((last.amount * 12) / effectiveMonths)
        : 0
    const totalSpent = payments.reduce((sum, item) => sum + item.amount, 0)
    const priceChangePct =
      last && prev && prev.amount > 0
        ? (last.amount - prev.amount) / prev.amount
        : null

    return {
      id: sub.id,
      planId: sub.plan_id,
      serviceName: plan?.service_name ?? '未知服务',
      category: plan?.category ?? '其他',
      planName: plan?.name ?? '未知套餐',
      cycleMonths: cycle,
      cycleDays,
      listPrice: plan?.list_price ?? 0,
      platform: sub.platform,
      account: sub.account,
      startedAt: sub.started_at,
      nextRenewalOverride: sub.next_renewal_override,
      autoRenew: Boolean(sub.auto_renew),
      status,
      note: sub.note,
      lastPayment: last
        ? { id: last.id, paidAt: last.paid_at, amount: last.amount }
        : null,
      prevPayment: prev
        ? { id: prev.id, paidAt: prev.paid_at, amount: prev.amount }
        : null,
      nextRenewalAt,
      daysLeft,
      annualized,
      totalSpent,
      paymentCount: payments.length,
      priceChangePct,
    }
  })

  const active = subscriptions.filter((sub) => sub.status === 'active')
  const expiredCount = subscriptions.filter((sub) => sub.status === 'expired').length
  const activePlanIds = new Set(active.map((sub) => sub.planId))
  const annualized = active.reduce((sum, sub) => sum + sub.annualized, 0)

  const upcoming = active
    .flatMap((sub) => {
      if (!sub.nextRenewalAt || sub.daysLeft === null || sub.daysLeft > 90) return []
      return [
        {
          subscriptionId: sub.id,
          serviceName: sub.serviceName,
          planName: sub.planName,
          date: sub.nextRenewalAt,
          daysLeft: sub.daysLeft,
          amount: sub.lastPayment?.amount ?? 0,
          platform: sub.platform,
          autoRenew: sub.autoRenew,
        },
      ]
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  const categoryMap = new Map<string, { category: string; annualized: number; count: number }>()
  for (const sub of active) {
    const entry = categoryMap.get(sub.category) ?? {
      category: sub.category,
      annualized: 0,
      count: 0,
    }
    entry.annualized += sub.annualized
    entry.count += 1
    categoryMap.set(sub.category, entry)
  }
  const categories = [...categoryMap.values()].sort((a, b) => b.annualized - a.annualized)

  const now = new Date()
  const monthKeys: string[] = []
  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    monthKeys.push(`${date.getFullYear()}-${pad2(date.getMonth() + 1)}`)
  }
  const monthTotals = new Map(monthKeys.map((key) => [key, 0]))
  let totalSpent = 0
  for (const payment of paymentRows) {
    totalSpent += payment.amount
    const key = payment.paid_at.slice(0, 7)
    if (monthTotals.has(key)) {
      monthTotals.set(key, (monthTotals.get(key) ?? 0) + payment.amount)
    }
  }
  const monthlySpend = monthKeys.map((month) => ({
    month,
    total: monthTotals.get(month) ?? 0,
  }))

  return {
    today,
    services: services.map((service) => ({
      id: service.id,
      name: service.name,
      category: service.category,
    })),
    plans: planRows.map((plan) => ({
      id: plan.id,
      serviceId: plan.service_id,
      serviceName: plan.service_name,
      category: plan.category,
      name: plan.name,
      cycleMonths: plan.cycle_months,
      cycleDays: plan.cycle_days,
      listPrice: plan.list_price,
      note: plan.note,
      subscribed: activePlanIds.has(plan.id),
    })),
    subscriptions,
    payments: [...paymentRows].reverse().map((payment) => ({
      id: payment.id,
      subscriptionId: payment.subscription_id,
      serviceName: payment.service_name,
      planName: payment.plan_name,
      paidAt: payment.paid_at,
      amount: payment.amount,
      note: payment.note,
      jointRenewalId: payment.joint_renewal_id,
    })),
    jointRenewals: jointRenewalRows.map((renewal) => ({
      id: renewal.id,
      mainSubscriptionId: renewal.main_subscription_id,
      mainServiceName: renewal.main_service_name,
      paidAt: renewal.paid_at,
      total: renewal.total,
      cycleMonths: renewal.cycle_months,
      costMode: renewal.cost_mode === 'main' ? 'main' : 'split',
      note: renewal.note,
      members: (jointMembersByRenewal.get(renewal.id) ?? []).map((member) => ({
        subscriptionId: member.subscription_id,
        serviceName: member.service_name,
        planName: member.plan_name,
        amount: member.amount,
        durationDays: member.duration_days ?? renewal.cycle_months * DAYS_PER_MONTH,
      })),
    })),
    snapshots: snapshotRows.map((snapshot) => ({
      id: snapshot.id,
      planId: snapshot.plan_id,
      serviceName: snapshot.service_name,
      planName: snapshot.plan_name,
      cycleMonths: snapshot.cycle_months,
      cycleDays: snapshot.cycle_days,
      capturedAt: snapshot.captured_at,
      durationDays: snapshot.duration_days,
      price: snapshot.price,
      platform: snapshot.platform,
      note: snapshot.note,
    })),
    jointQuotes: jointQuoteRows.map((quote) => {
      const items = jointQuoteItemsByQuote.get(quote.id) ?? []
      const mainIndex = items.findIndex(
        (item) => item.subscription_id === quote.main_subscription_id,
      )
      const amounts = allocateJointQuoteAmounts(
        quote.total,
        items.map(
          (item) => item.duration_days ?? quote.cycle_months * DAYS_PER_MONTH,
        ),
        quote.cost_mode === 'main' ? 'main' : 'split',
        mainIndex,
      )
      return {
        id: quote.id,
        capturedAt: quote.captured_at,
        total: quote.total,
        cycleMonths: quote.cycle_months,
        mainSubscriptionId: quote.main_subscription_id,
        costMode: quote.cost_mode === 'main' ? 'main' : 'split',
        platform: quote.platform,
        note: quote.note,
        items: items.map((item, index) => {
          const payments = paymentsBySub.get(item.subscription_id) ?? []
          const latest = payments.at(-1) ?? null
          const effectiveMonths = latest
            ? latest.duration_days !== null
              ? latest.duration_days / DAYS_PER_MONTH
              : item.plan_cycle_days !== null && item.plan_cycle_days > 0
                ? item.plan_cycle_days / DAYS_PER_MONTH
                : item.plan_cycle_months
            : 0
          return {
            subscriptionId: item.subscription_id,
            serviceName: item.service_name,
            planName: item.plan_name,
            durationDays: item.duration_days ?? quote.cycle_months * DAYS_PER_MONTH,
            amount: amounts[index] ?? 0,
            monthly:
              latest && effectiveMonths > 0
                ? Math.round(latest.amount / effectiveMonths)
                : null,
          }
        }),
      }
    }),
    stats: {
      activeCount: active.length,
      annualized,
      monthly: Math.round(annualized / 12),
      totalSpent,
      upcoming30: upcoming.filter((item) => item.daysLeft >= 0 && item.daysLeft <= 30).length,
      expiredCount,
      categories,
      monthlySpend,
      upcoming,
    },
  }
}

export type AppState = ReturnType<typeof buildState>
