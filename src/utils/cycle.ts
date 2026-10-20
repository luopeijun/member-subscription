/** 计费周期统一用「月数」表示，0 为一次性付费，-1 为买断。 */
export const CYCLE_OPTIONS = [
  { value: 1, label: '月付' },
  { value: 3, label: '季付' },
  { value: 6, label: '半年付' },
  { value: 12, label: '年付' },
  { value: 0, label: '一次性付费' },
  { value: -1, label: '买断（永久）' },
]

export function equivalentMonthly(cycleMonths: number, amount: number): number | null {
  if (cycleMonths <= 0) return null
  return Math.round(amount / cycleMonths)
}

export function cycleLabel(months: number): string {
  switch (months) {
    case -1:
      return '买断'
    case 0:
      return '一次性付费'
    case 1:
      return '月付'
    case 3:
      return '季付'
    case 6:
      return '半年付'
    case 12:
      return '年付'
    default:
      return `${months} 个月`
  }
}
