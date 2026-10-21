import type { Subscription } from '@/types'
import type { MemberJointQuoteEntry } from '@/utils/jointQuote'
import { formatCNY } from '@shared/money'
import { DaysBadge, StatusBadge } from '@/components/Badge/Badge'
import { cycleLabel } from '@/utils/cycle'
import { formatDate } from '@/utils/format'
import { SubscriptionJointQuote } from './SubscriptionJointQuote'
import './SubscriptionCard.scss'

type SubscriptionCardProps = {
  subscription: Subscription
  jointQuoteEntries: MemberJointQuoteEntry[]
  onEdit: (subscription: Subscription) => void
  onRenew: (subscription: Subscription) => void
  onDelete: (subscription: Subscription) => void
}

export function SubscriptionCard({
  subscription: sub,
  jointQuoteEntries,
  onEdit,
  onRenew,
  onDelete,
}: SubscriptionCardProps) {
  return (
    <article className="card sub-card">
      <header className="sub-head">
        <div>
          <h3>{sub.serviceName}</h3>
          <p>
            {sub.planName} · {cycleLabel(sub.cycleMonths, sub.cycleDays)}
          </p>
        </div>
        <StatusBadge status={sub.status} />
      </header>

      <div className="tag-row">
        <span className="badge muted">{sub.platform ?? '平台未记录'}</span>
        {sub.autoRenew ? (
          <span className="badge info">自动续费</span>
        ) : (
          <span className="badge muted">手动续费</span>
        )}
        {sub.note ? <span className="badge muted">{sub.note}</span> : null}
      </div>

      <div className="sub-price">
        <div>
          <span>最近支付</span>
          <strong>{sub.lastPayment ? formatCNY(sub.lastPayment.amount) : '—'}</strong>
          <small>
            {sub.lastPayment
              ? formatDate(sub.lastPayment.paidAt)
              : sub.status === 'planned'
                ? '还没买'
                : '未记录支付'}
          </small>
        </div>
        <div>
          <span>月均成本</span>
          <strong>
            {sub.status === 'planned' ||
            (sub.annualized <= 0 && (sub.cycleDays ?? 0) > 0)
              ? '—'
              : sub.annualized > 0
                ? formatCNY(Math.round(sub.annualized / 12))
                : cycleLabel(sub.cycleMonths, sub.cycleDays)}
          </strong>
          <small>
            {sub.status === 'planned'
              ? '尚未产生支出'
              : `累计 ${formatCNY(sub.totalSpent)} · ${sub.paymentCount} 笔`}
          </small>
        </div>
      </div>

      {sub.priceChangePct !== null && Math.abs(sub.priceChangePct) >= 0.001 ? (
        <div className={`price-change ${sub.priceChangePct > 0 ? 'up' : 'down'}`}>
          较上次续费 {sub.priceChangePct > 0 ? '上涨' : '下降'}{' '}
          {Math.abs(sub.priceChangePct * 100).toFixed(1)}%
          {sub.lastPayment && sub.prevPayment
            ? `（${formatCNY(sub.prevPayment.amount)} → ${formatCNY(sub.lastPayment.amount)}）`
            : ''}
        </div>
      ) : null}

      <SubscriptionJointQuote entries={jointQuoteEntries} />

      <div className="sub-renewal">
        {sub.nextRenewalAt ? (
          <>
            <div>
              <span>
                {sub.nextRenewalOverride
                  ? sub.status === 'active'
                    ? '下次续费（手动）'
                    : '到期日（手动）'
                  : sub.status === 'active'
                    ? '下次续费'
                    : '到期日'}
              </span>
              <strong>{formatDate(sub.nextRenewalAt)}</strong>
            </div>
            {sub.status === 'active' ? (
              sub.daysLeft !== null ? <DaysBadge days={sub.daysLeft} /> : null
            ) : sub.daysLeft !== null && sub.daysLeft < 0 ? (
              <span className="badge danger">已过期 {Math.abs(sub.daysLeft)} 天</span>
            ) : null}
          </>
        ) : (
          <span className="muted">
            {sub.status === 'planned'
              ? '想买但还没买，点「记一笔购买」开始记录'
              : sub.status === 'active'
                ? sub.cycleMonths === -1
                  ? '买断，永久有效'
                  : '一次性付费，无后续扣款'
                : '无到期记录'}
          </span>
        )}
      </div>

      <footer className="sub-actions">
        <button className="btn sm" onClick={() => onRenew(sub)}>
          {sub.status === 'planned' ? '记一笔购买' : '记一笔续费'}
        </button>
        <button className="btn sm" onClick={() => onEdit(sub)}>
          编辑
        </button>
        <button className="btn sm danger" onClick={() => onDelete(sub)}>
          删除
        </button>
      </footer>
    </article>
  )
}
