import { db } from './db'
import { addMonths, daysBetween, pad2, todayISO } from './util'

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
  shared_with: string | null
  note: string | null
  joint_parent_id: number | null
  joint_cost_mode: string
}

type PaymentRow = {
  id: number
  subscription_id: number
  paid_at: string
  amount: number
  note: string | null
  joint_purchase_id: string | null
  service_name: string
  plan_name: string
  cycle_months: number
}

type JointChild = {
  id: number
  serviceName: string
  planName: string
  nextRenewalAt: string | null
  status: string
}

type SnapshotRow = {
  id: number
  plan_id: number
  captured_at: string
  price: number
  platform: string | null
  note: string | null
  service_name: string
  plan_name: string
  cycle_months: number
}

export function buildState() {
  const services = db
    .prepare('SELECT id, name, category FROM services ORDER BY name COLLATE NOCASE')
    .all() as ServiceRow[]

  const planRows = db
    .prepare(
      `SELECT p.id, p.service_id, p.name, p.cycle_months, p.list_price, p.note,
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
      `SELECT pay.id, pay.subscription_id, pay.paid_at, pay.amount, pay.note, pay.joint_purchase_id,
        s.name AS service_name, pl.name AS plan_name, pl.cycle_months
      FROM payments pay
      JOIN subscriptions sub ON sub.id = pay.subscription_id
      JOIN plans pl ON pl.id = sub.plan_id
      JOIN services s ON s.id = pl.service_id
      ORDER BY pay.paid_at, pay.id`,
    )
    .all() as PaymentRow[]

  const snapshotRows = db
    .prepare(
      `SELECT ps.id, ps.plan_id, ps.captured_at, ps.price, ps.cycle_months, ps.platform, ps.note,
        s.name AS service_name, pl.name AS plan_name
      FROM price_snapshots ps
      JOIN plans pl ON pl.id = ps.plan_id
      JOIN services s ON s.id = pl.service_id
      ORDER BY ps.captured_at DESC, ps.id DESC`,
    )
    .all() as SnapshotRow[]

  const paymentsBySub = new Map<number, PaymentRow[]>()
  for (const payment of paymentRows) {
    const list = paymentsBySub.get(payment.subscription_id) ?? []
    list.push(payment)
    paymentsBySub.set(payment.subscription_id, list)
  }

  const today = todayISO()

  const subscriptions = subRows.map((sub) => {
    const plan = planById.get(sub.plan_id)
    const payments = paymentsBySub.get(sub.id) ?? []
    const last = payments.at(-1) ?? null
    const prev = payments.at(-2) ?? null
    const cycle = plan?.cycle_months ?? 12

    const computedNext =
      cycle > 0 ? addMonths(last?.paid_at ?? sub.started_at, cycle) : null
    const nextRenewalAt = sub.next_renewal_override || computedNext
    const daysLeft = nextRenewalAt ? daysBetween(today, nextRenewalAt) : null

    const annualized =
      cycle > 0 && last ? Math.round((last.amount * 12) / cycle) : 0
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
      listPrice: plan?.list_price ?? 0,
      platform: sub.platform,
      account: sub.account,
      startedAt: sub.started_at,
      nextRenewalOverride: sub.next_renewal_override,
      autoRenew: Boolean(sub.auto_renew),
      status: sub.status,
      sharedWith: sub.shared_with,
      note: sub.note,
      jointParentId: sub.joint_parent_id,
      jointParentName: null as string | null,
      jointCostMode: sub.joint_cost_mode === 'main' ? 'main' : 'split',
      jointChildren: [] as JointChild[],
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

  const subscriptionById = new Map(subscriptions.map((sub) => [sub.id, sub]))
  for (const sub of subscriptions) {
    if (sub.jointParentId === null) continue
    const parent = subscriptionById.get(sub.jointParentId)
    if (!parent) continue
    sub.jointParentName = parent.serviceName
    parent.jointChildren.push({
      id: sub.id,
      serviceName: sub.serviceName,
      planName: sub.planName,
      nextRenewalAt: sub.nextRenewalAt,
      status: sub.status,
    })
  }

  const active = subscriptions.filter((sub) => sub.status === 'active')
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
      listPrice: plan.list_price,
      note: plan.note,
      subscribed: Boolean(plan.subscribed),
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
      jointPurchaseId: payment.joint_purchase_id,
    })),
    snapshots: snapshotRows.map((snapshot) => ({
      id: snapshot.id,
      planId: snapshot.plan_id,
      serviceName: snapshot.service_name,
      planName: snapshot.plan_name,
      cycleMonths: snapshot.cycle_months,
      capturedAt: snapshot.captured_at,
      price: snapshot.price,
      platform: snapshot.platform,
      note: snapshot.note,
    })),
    stats: {
      activeCount: active.length,
      annualized,
      monthly: Math.round(annualized / 12),
      totalSpent,
      upcoming30: upcoming.filter((item) => item.daysLeft >= 0 && item.daysLeft <= 30).length,
      overdueCount: upcoming.filter((item) => item.daysLeft < 0).length,
      categories,
      monthlySpend,
      upcoming,
    },
  }
}

export type AppState = ReturnType<typeof buildState>
