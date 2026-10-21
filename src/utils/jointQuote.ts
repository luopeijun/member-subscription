import type { JointQuote, JointQuoteItem } from '@/types'
import { DAYS_PER_MONTH } from '@shared/duration'

export type JointQuoteCompanion = {
  subscriptionId: number
  serviceName: string
  planName: string
}

export type MemberJointQuoteEntry = {
  quote: JointQuote
  item: JointQuoteItem
  companions: JointQuoteCompanion[]
  allocatedMonthly: number | null
  diff: number | null
}

function compareBySaving(a: MemberJointQuoteEntry, b: MemberJointQuoteEntry): number {
  if (a.diff === null && b.diff === null) {
    return b.quote.capturedAt.localeCompare(a.quote.capturedAt) || b.quote.id - a.quote.id
  }
  if (a.diff === null) return 1
  if (b.diff === null) return -1
  if (a.diff !== b.diff) return a.diff - b.diff
  return b.quote.capturedAt.localeCompare(a.quote.capturedAt) || b.quote.id - a.quote.id
}

/** 把联合报价按参与会员展开，并按分摊后差额从省到贵排序。 */
export function buildMemberJointQuoteEntries(
  jointQuotes: JointQuote[],
): Map<number, MemberJointQuoteEntry[]> {
  const bySubscription = new Map<number, MemberJointQuoteEntry[]>()

  for (const quote of jointQuotes) {
    for (const item of quote.items) {
      const allocatedMonthly =
        item.durationDays > 0
          ? Math.round((item.amount * DAYS_PER_MONTH) / item.durationDays)
          : null
      const diff =
        allocatedMonthly !== null && item.monthly !== null
          ? allocatedMonthly - item.monthly
          : null
      const companions = quote.items
        .filter((other) => other.subscriptionId !== item.subscriptionId)
        .map((other) => ({
          subscriptionId: other.subscriptionId,
          serviceName: other.serviceName,
          planName: other.planName,
        }))

      const entries = bySubscription.get(item.subscriptionId) ?? []
      entries.push({ quote, item, companions, allocatedMonthly, diff })
      bySubscription.set(item.subscriptionId, entries)
    }
  }

  for (const entries of bySubscription.values()) {
    entries.sort(compareBySaving)
  }

  return bySubscription
}
