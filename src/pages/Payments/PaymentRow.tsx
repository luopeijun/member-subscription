import type { Payment } from '@/types'
import { formatCNY } from '@shared/money'
import './PaymentRow.scss'

type PaymentRowProps = {
  payment: Payment
  onDelete: (payment: Payment) => void
}

export function PaymentRow({ payment, onDelete }: PaymentRowProps) {
  return (
    <div className="pay-row">
      <span className="pay-date nowrap">{payment.paidAt}</span>
      <div className="pay-member">
        <div className="cell-strong">{payment.serviceName}</div>
        <div className="cell-sub">{payment.planName}</div>
      </div>
      <span className="pay-amount num nowrap">{formatCNY(payment.amount)}</span>
      <span className="pay-note muted">{payment.note ?? '—'}</span>
      <span className="pay-actions num">
        <button className="btn sm danger" onClick={() => onDelete(payment)}>
          删除
        </button>
      </span>
    </div>
  )
}
