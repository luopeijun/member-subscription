import type { Subscription } from '@/types'
import { addDaysISO } from '@shared/duration'

export type MonthlySpend = {
  month: string
  total: number
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function addMonthsISO(value: string, months: number): string {
  const [year, month, day] = value.split('-').map(Number)
  const targetIndex = month - 1 + months
  const targetYear = year + Math.floor(targetIndex / 12)
  const targetMonth = ((targetIndex % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const targetDay = Math.min(day, lastDay)
  return `${targetYear}-${pad2(targetMonth + 1)}-${pad2(targetDay)}`
}

function monthKeysFrom(startISO: string, count: number): string[] {
  const [year, month] = startISO.split('-').map(Number)
  const keys: string[] = []
  for (let offset = 0; offset < count; offset += 1) {
    const date = new Date(year, month - 1 + offset, 1)
    keys.push(`${date.getFullYear()}-${pad2(date.getMonth() + 1)}`)
  }
  return keys
}

/**
 * 按下次续费日和计费周期，估算未来 12 个月的续费支出。
 * 只用活跃会员、且已经有支付记录和下次续费日的数据。
 */
export function buildRenewalForecast(
  subscriptions: Subscription[],
  today: string,
  count = 12,
): MonthlySpend[] {
  const months = monthKeysFrom(today, count)
  const totals = new Map(months.map((month) => [month, 0]))
  const endMonth = months.at(-1) ?? today.slice(0, 7)

  for (const subscription of subscriptions) {
    if (subscription.status !== 'active') continue
    if (!subscription.nextRenewalAt || !subscription.lastPayment) continue
    if (subscription.lastPayment.amount <= 0) continue

    let date = subscription.nextRenewalAt
    if (date < today) continue

    const stepDays =
      subscription.cycleDays !== null && subscription.cycleDays > 0
        ? subscription.cycleDays
        : null
    const stepMonths =
      stepDays === null && subscription.cycleMonths > 0
        ? subscription.cycleMonths
        : null

    for (let index = 0; index < 400; index += 1) {
      const month = date.slice(0, 7)
      if (month > endMonth) break

      if (totals.has(month)) {
        totals.set(month, (totals.get(month) ?? 0) + subscription.lastPayment.amount)
      }

      if (stepDays !== null) {
        date = addDaysISO(date, stepDays)
      } else if (stepMonths !== null) {
        date = addMonthsISO(date, stepMonths)
      } else {
        break
      }
    }
  }

  return months.map((month) => ({ month, total: totals.get(month) ?? 0 }))
}
