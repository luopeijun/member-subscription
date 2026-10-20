import type { ReactNode } from 'react'
import { Modal } from '@/components/Modal/Modal'
import './ConfirmDialog.scss'

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
