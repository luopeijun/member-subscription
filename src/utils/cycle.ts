import { DAYS_PER_MONTH } from '@shared/duration'

export type CycleOption = {
  key: string
  label: string
  cycleMonths: number
  cycleDays: number | null
}

/**
 * 计费周期统一用「月数 + 天数」表示：
 * - 月周期：cycleMonths > 0，cycleDays 为 null
 * - 天周期：cycleMonths = 0，cycleDays > 0
 * - 一次性付费：cycleMonths = 0，cycleDays 为 null
 * - 买断：cycleMonths = -1，cycleDays 为 null
 */
export const CYCLE_OPTIONS: CycleOption[] = [
  { key: 'day:1', label: '1 天', cycleMonths: 0, cycleDays: 1 },
  { key: 'day:7', label: '1 周', cycleMonths: 0, cycleDays: 7 },
  { key: 'month:1', label: '月付', cycleMonths: 1, cycleDays: null },
  { key: 'month:3', label: '季付', cycleMonths: 3, cycleDays: null },
  { key: 'month:6', label: '半年付', cycleMonths: 6, cycleDays: null },
  { key: 'month:12', label: '年付', cycleMonths: 12, cycleDays: null },
  { key: 'month:24', label: '2 年', cycleMonths: 24, cycleDays: null },
  { key: 'month:0', label: '一次性付费', cycleMonths: 0, cycleDays: null },
  { key: 'month:-1', label: '买断（永久）', cycleMonths: -1, cycleDays: null },
]

export function cycleKey(cycleMonths: number, cycleDays: number | null): string {
  if (cycleDays !== null && cycleDays > 0) return `day:${cycleDays}`
  return `month:${cycleMonths}`
}

export function readCycle(key: string): {
  cycleMonths: number
  cycleDays: number | null
} {
  const known = CYCLE_OPTIONS.find((option) => option.key === key)
  if (known) {
    return { cycleMonths: known.cycleMonths, cycleDays: known.cycleDays }
  }

  const [kind, raw] = key.split(':')
  const value = Number(raw)
  if (kind === 'day' && Number.isInteger(value) && value > 0) {
    return { cycleMonths: 0, cycleDays: value }
  }
  if (kind === 'month' && Number.isInteger(value)) {
    return { cycleMonths: value, cycleDays: null }
  }
  return { cycleMonths: 12, cycleDays: null }
}

/** 导入的旧数据可能带自定义天数，补一条选项避免下拉框显示空白。 */
export function cycleOptions(
  cycleMonths: number,
  cycleDays: number | null,
): CycleOption[] {
  const key = cycleKey(cycleMonths, cycleDays)
  if (CYCLE_OPTIONS.some((option) => option.key === key)) return CYCLE_OPTIONS
  return [
    ...CYCLE_OPTIONS,
    {
      key,
      label: cycleLabel(cycleMonths, cycleDays),
      cycleMonths,
      cycleDays,
    },
  ]
}

export function cycleMonthly(
  cycleMonths: number,
  cycleDays: number | null,
  amount: number,
): number | null {
  if (cycleDays !== null && cycleDays > 0) {
    return Math.round((amount * DAYS_PER_MONTH) / cycleDays)
  }
  if (cycleMonths > 0) return Math.round(amount / cycleMonths)
  return null
}

export function cycleLabel(cycleMonths: number, cycleDays: number | null = null): string {
  if (cycleDays !== null && cycleDays > 0) {
    if (cycleDays === 1) return '1 天'
    if (cycleDays === 7) return '1 周'
    return `${cycleDays} 天`
  }

  switch (cycleMonths) {
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
    case 24:
      return '2 年'
    default:
      return `${cycleMonths} 个月`
  }
}
