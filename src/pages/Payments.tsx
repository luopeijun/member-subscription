import type { AppState, Payment } from '../types'
import { formatCNY } from '../../shared/money'
import { EmptyState } from '../ui'

type Props = {
  state: AppState
  onAdd: () => void
  onDelete: (payment: Payment) => void
}

export function Payments({ state, onAdd, onDelete }: Props) {
  const total = state.payments.reduce((sum, payment) => sum + payment.amount, 0)
  const average = state.payments.length > 0 ? Math.round(total / state.payments.length) : 0

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="inline-stats">
          <span>
            共 <strong>{state.payments.length}</strong> 笔
          </span>
          <span>
            合计 <strong>{formatCNY(total)}</strong>
          </span>
          <span>
            单笔均值 <strong>{formatCNY(average)}</strong>
          </span>
        </div>
        <button className="btn primary" onClick={onAdd} disabled={state.subscriptions.length === 0}>
          + 记一笔支付
        </button>
      </div>

      {state.payments.length === 0 ? (
        <div className="card card-pad">
          <EmptyState
            title="还没有支付流水"
            description="每次续费后记一笔，能从流水里看到涨价和实际年化成本。"
            action={
              <button
                className="btn primary"
                onClick={onAdd}
                disabled={state.subscriptions.length === 0}
              >
                记一笔支付
              </button>
            }
          />
        </div>
      ) : (
        <div className="card table-card">
          <table className="table">
            <thead>
              <tr>
                <th>支付日期</th>
                <th>会员</th>
                <th className="num">金额</th>
                <th>备注</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {state.payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="nowrap">{payment.paidAt}</td>
                  <td>
                    <div className="cell-strong">{payment.serviceName}</div>
                    <div className="cell-sub">{payment.planName}</div>
                  </td>
                  <td className="num nowrap">{formatCNY(payment.amount)}</td>
                  <td className="muted">{payment.note ?? '—'}</td>
                  <td className="num">
                    <button className="btn sm danger" onClick={() => onDelete(payment)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="page-note">
        删除支付记录会改变对应会员的年化成本与累计支出，但不会自动改“下次续费日”。
        如果误删了最近一笔，记得在会员编辑里覆盖下次续费日期。
      </p>
    </div>
  )
}
