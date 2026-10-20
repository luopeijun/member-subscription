export const DAYS_PER_YEAR = 365

/** 单次可录入的最长时长，和接口校验保持一致。 */
export const MAX_DURATION_DAYS = 3650

/** 一个月按 365 / 12 天折算，这样 365 天正好等于 12 个月。 */
export const DAYS_PER_MONTH = DAYS_PER_YEAR / 12

/** 联合续费 / 联合报价里，每个会员拿到的时长统一用「天」表示。 */
export function formatDuration(days: number): string {
  if (days <= 0) return '未设置'
  return `${days} 天`
}

/** 在 YYYY-MM-DD 上加减天数，统一按 UTC 计算，避免时区误差。 */
export function addDaysISO(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    '0',
  )}-${String(date.getUTCDate()).padStart(2, '0')}`
}

/** 两个 YYYY-MM-DD 之间相差的天数，统一按 UTC 计算。 */
export function daysBetweenISO(from: string, to: string): number {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number)
  const [toYear, toMonth, toDay] = to.split('-').map(Number)
  return Math.round(
    (Date.UTC(toYear, toMonth - 1, toDay) -
      Date.UTC(fromYear, fromMonth - 1, fromDay)) /
      86_400_000,
  )
}

/** 常见时长的快捷选项，方便一次点选。 */
export const DURATION_PRESETS: { days: number; label: string }[] = [
  { days: 1, label: '1 天' },
  { days: 7, label: '1 周' },
  { days: 30, label: '1 个月' },
  { days: 90, label: '3 个月' },
  { days: 180, label: '6 个月' },
  { days: 365, label: '1 年' },
  { days: 395, label: '1 年 + 1 个月' },
  { days: 455, label: '1 年 + 3 个月' },
  { days: 545, label: '1 年 + 6 个月' },
  { days: 730, label: '2 年' },
]
