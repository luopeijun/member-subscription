import { statusLabel } from '../../lib/format'

export function DaysBadge({ days }: { days: number }) {
  if (days < 0) {
    return <span className="badge danger">已过期 {Math.abs(days)} 天</span>
  }
  if (days === 0) {
    return <span className="badge warn">今天到期</span>
  }
  if (days <= 7) {
    return <span className="badge warn">{days} 天后</span>
  }
  if (days <= 30) {
    return <span className="badge info">{days} 天后</span>
  }
  return <span className="badge muted">{days} 天后</span>
}

export function StatusBadge({ status }: { status: string }) {
  const tone = status === 'active' ? 'ok' : status === 'planned' ? 'info' : 'danger'
  return <span className={`badge ${tone}`}>{statusLabel(status)}</span>
}
