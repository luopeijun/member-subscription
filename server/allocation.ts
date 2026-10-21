export function allocateJointQuoteAmounts(
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
