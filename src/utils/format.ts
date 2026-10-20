import { STATUS_OPTIONS } from '@/constants'

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-').map(Number)
  return `${year}年${month}月${day}日`
}

export function formatDay(iso: string | null): string {
  if (!iso) return '—'
  const [, month, day] = iso.split('-').map(Number)
  return `${month}月${day}日`
}

export function monthLabel(key: string): string {
  const [, month] = key.split('-').map(Number)
  return `${month}月`
}

export function statusLabel(value: string): string {
  return STATUS_OPTIONS.find((item) => item.value === value)?.label ?? value
}
