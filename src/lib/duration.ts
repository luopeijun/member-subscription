export function clampDurationDays(value: string): number {
  const parsed = Math.floor(Number(value))
  if (!Number.isFinite(parsed)) return 1
  return Math.min(3650, Math.max(1, parsed))
}
