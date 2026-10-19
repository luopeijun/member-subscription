export const DAYS_PER_MONTH = 30

/** 联合续费 / 联合报价里，每个会员拿到的时长统一用「天」表示。 */
export function formatDuration(days: number): string {
  if (days <= 0) return '未设置'
  return `${days} 天`
}

/** 常见时长的快捷选项，方便一次点选。 */
export const DURATION_PRESETS: { days: number; label: string }[] = [
  { days: 7, label: '7 天' },
  { days: 30, label: '1 个月' },
  { days: 90, label: '3 个月' },
  { days: 180, label: '6 个月' },
  { days: 360, label: '1 年' },
  { days: 390, label: '1 年 + 1 个月' },
]
