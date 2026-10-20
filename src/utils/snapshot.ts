import type { Snapshot } from '@/types'
import { DAYS_PER_MONTH, daysBetweenISO } from '@shared/duration'
import { cycleLabel, cycleMonthly } from '@/utils/cycle'

type SnapshotTerm = Pick<
  Snapshot,
  'capturedAt' | 'expiresAt' | 'cycleMonths' | 'cycleDays'
>

export function snapshotMonthly(
  offer: SnapshotTerm & { price: number },
): number | null {
  if (offer.expiresAt) {
    const days = daysBetweenISO(offer.capturedAt, offer.expiresAt)
    if (days > 0) {
      return Math.round((offer.price * DAYS_PER_MONTH) / days)
    }
  }
  return cycleMonthly(offer.cycleMonths, offer.cycleDays, offer.price)
}

export function formatTermDays(days: number): string {
  if (days <= 0) return '—'
  if (days < 60) return `${days} 天`
  const months = Math.round((days / DAYS_PER_MONTH) * 10) / 10
  if (months < 12) return `${months} 个月`
  const years = Math.floor(months / 12)
  const rest = Math.round((months - years * 12) * 10) / 10
  return rest > 0 ? `${years} 年 ${rest} 个月` : `${years} 年`
}

export function snapshotTermLabel(offer: SnapshotTerm): string {
  if (offer.expiresAt) {
    const days = daysBetweenISO(offer.capturedAt, offer.expiresAt)
    if (days > 0) return `约 ${formatTermDays(days)}`
  }
  return cycleLabel(offer.cycleMonths, offer.cycleDays)
}

export function latestPerPlatform(snapshots: Snapshot[], planId: number): Snapshot[] {
  const map = new Map<string, Snapshot>()
  for (const snapshot of snapshots) {
    if (snapshot.planId !== planId) continue
    const key = (snapshot.platform ?? '未标注').trim().toLowerCase()
    if (!map.has(key)) map.set(key, snapshot)
  }
  return [...map.values()].sort((a, b) => a.price - b.price)
}

export function searchSnapshots(snapshots: Snapshot[], keyword: string): Snapshot[] {
  if (!keyword) return snapshots
  return snapshots.filter(
    (snapshot) =>
      snapshot.serviceName.toLowerCase().includes(keyword) ||
      snapshot.planName.toLowerCase().includes(keyword),
  )
}
