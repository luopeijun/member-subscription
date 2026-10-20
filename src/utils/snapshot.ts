import type { Snapshot } from '@/types'

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
