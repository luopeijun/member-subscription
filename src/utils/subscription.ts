import type { Subscription } from '@/types'

export function monthlyEquivalent(sub: Subscription): number | null {
  if (!sub.lastPayment || sub.annualized <= 0) return null
  return Math.round(sub.annualized / 12)
}

export function subscriptionMatchesQuery(sub: Subscription, keyword: string): boolean {
  if (!keyword) return true
  return [sub.serviceName, sub.planName, sub.platform, sub.account, sub.note].some(
    (value) => Boolean(value && value.toLowerCase().includes(keyword)),
  )
}

const STATUS_ORDER: Record<string, number> = { active: 0, planned: 1, expired: 2 }

export function sortSubscriptions(a: Subscription, b: Subscription): number {
  if (a.status !== b.status) {
    return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
  }
  if (a.nextRenewalAt && b.nextRenewalAt) {
    return a.nextRenewalAt.localeCompare(b.nextRenewalAt)
  }
  if (a.nextRenewalAt) return -1
  if (b.nextRenewalAt) return 1
  return a.serviceName.localeCompare(b.serviceName)
}
