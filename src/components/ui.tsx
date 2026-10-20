import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export const CYCLE_OPTIONS = [
  { value: 1, label: '月付' },
  { value: 3, label: '季付' },
  { value: 6, label: '半年付' },
  { value: 12, label: '年付' },
  { value: 0, label: '一次性付费' },
  { value: -1, label: '买断（永久）' },
]

export const CATEGORIES = [
  '影音娱乐',
  '软件工具',
  'AI 服务',
  '云存储',
  '会员权益',
  '教育学习',
  '游戏',
  '其他',
]

export const PLATFORM_SUGGESTIONS = [
  '官网',
  'App Store',
  'Google Play',
  '淘宝',
  '闲鱼',
  '拼车群',
  '其他',
]

export const STATUS_OPTIONS = [
  { value: 'active', label: '活跃' },
  { value: 'planned', label: '想买' },
  { value: 'expired', label: '已过期' },
]

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

export function DaysBadge({ days }: { days: number }) {
  if (days < 0) {
    return <span className="badge danger">已逾期 {Math.abs(days)} 天</span>
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
  const tone = status === 'active' ? 'ok' : status === 'planned' ? 'info' : 'muted'
  return <span className={`badge ${tone}`}>{statusLabel(status)}</span>
}

type ModalProps = {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  className?: string
}

export function Modal({ title, subtitle, onClose, children, className }: ModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className={`modal ${className ?? ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

type ConfirmDialogProps = {
  title: string
  subtitle?: string
  children: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  confirmDisabled?: boolean
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  title,
  subtitle,
  children,
  confirmLabel = '确认',
  cancelLabel = '取消',
  tone = 'danger',
  confirmDisabled = false,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} className="confirm-modal">
      <div className="confirm-lead">
        <span className={`confirm-icon ${tone}`} aria-hidden="true">
          !
        </span>
        <div className="confirm-copy">{children}</div>
      </div>
      <div className="modal-foot">
        <button type="button" className="btn" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`btn ${tone === 'danger' ? 'danger-solid' : 'primary'}`}
          onClick={onConfirm}
          disabled={confirmDisabled || busy}
        >
          {busy ? '处理中…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty-dot" />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}
