import { db } from './db'
import { HttpError } from './errors'
import { addMonths, todayISO } from './util'

type DemoItem = {
  service: string
  category: string
  plan: string
  cycle: number
  amount: number
  platform: string
  count: number
  account: string
  note?: string
}

const DEMO: DemoItem[] = [
  {
    service: 'Netflix',
    category: '影音娱乐',
    plan: '高级会员',
    cycle: 1,
    amount: 7800,
    platform: '官网',
    count: 14,
    account: 'demo@example.com',
  },
  {
    service: 'iCloud+',
    category: '云存储',
    plan: '200GB',
    cycle: 1,
    amount: 2100,
    platform: 'App Store',
    count: 20,
    account: 'demo@icloud.com',
  },
  {
    service: 'ChatGPT',
    category: 'AI 服务',
    plan: 'Plus',
    cycle: 1,
    amount: 14500,
    platform: '官网',
    count: 10,
    account: 'demo@example.com',
  },
  {
    service: 'Spotify',
    category: '影音娱乐',
    plan: '家庭组',
    cycle: 1,
    amount: 3000,
    platform: '淘宝',
    count: 9,
    account: 'demo@example.com',
    note: '代充，卖家代付',
  },
  {
    service: '1Password',
    category: '软件工具',
    plan: '家庭版',
    cycle: 12,
    amount: 42800,
    platform: '官网',
    count: 2,
    account: 'demo@example.com',
  },
]

export function seedDemoData() {
  const existing = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM services) AS services,
        (SELECT COUNT(*) FROM plans) AS plans,
        (SELECT COUNT(*) FROM subscriptions) AS subscriptions`,
    )
    .get() as { services: number; plans: number; subscriptions: number }

  if (existing.services > 0 || existing.plans > 0 || existing.subscriptions > 0) {
    throw new HttpError(409, '已有数据，不能载入示例数据。请先清空数据。')
  }

  const now = new Date().toISOString()
  const today = todayISO()

  const insertService = db.prepare(
    'INSERT INTO services (name, category, created_at) VALUES (?, ?, ?)',
  )
  const insertPlan = db.prepare(
    `INSERT INTO plans (service_id, name, cycle_months, list_price, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
  const insertSub = db.prepare(
    `INSERT INTO subscriptions (plan_id, platform, account, started_at, auto_renew, status, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const insertPayment = db.prepare(
    `INSERT INTO payments (subscription_id, paid_at, amount, note, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  )

  const run = db.transaction((items: DemoItem[]) => {
    for (const item of items) {
      const serviceId = Number(
        insertService.run(item.service, item.category, now).lastInsertRowid,
      )
      const planId = Number(
        insertPlan.run(serviceId, item.plan, item.cycle, item.amount, null, now).lastInsertRowid,
      )
      const start = addMonths(today, -item.cycle * (item.count - 1))
      const subId = Number(
        insertSub.run(
          planId,
          item.platform,
          item.account,
          start,
          1,
          'active',
          item.note ?? null,
          now,
        ).lastInsertRowid,
      )
      for (let index = 0; index < item.count; index += 1) {
        insertPayment.run(subId, addMonths(start, index * item.cycle), item.amount, null, now)
      }
    }
  })

  run(DEMO)
}
