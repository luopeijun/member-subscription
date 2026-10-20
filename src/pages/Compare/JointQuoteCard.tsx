import type { JointQuote } from '@/types'
import { formatCNY } from '@shared/money'
import { DAYS_PER_MONTH, formatDuration } from '@shared/duration'
import { formatDay } from '@/utils/format'
import './JointQuoteCard.scss'

type JointQuoteCardProps = {
  quote: JointQuote
  onDelete: (jointQuote: JointQuote) => void
}

export function JointQuoteCard({ quote, onDelete }: JointQuoteCardProps) {
  const entries = quote.items.map((item) => {
    const currentCost =
      item.monthly !== null && item.durationDays > 0
        ? Math.round((item.monthly * item.durationDays) / DAYS_PER_MONTH)
        : null
    return { item, currentCost }
  })
  const currentTotal = entries.reduce((sum, entry) => sum + (entry.currentCost ?? 0), 0)
  const excluded = entries.filter((entry) => entry.currentCost === null).length
  const diff = quote.items.length > 0 ? quote.total - currentTotal : null
  const mainName =
    quote.items.find((item) => item.subscriptionId === quote.mainSubscriptionId)
      ?.serviceName ?? '已删除会员'

  return (
    <article className="joint-quote-card">
      <div className="joint-quote-head">
        <div>
          <strong>
            {quote.platform ?? '未标注'} · {formatDay(quote.capturedAt)}
          </strong>
          <span>
            {quote.items.length} 个会员 · 总价 {formatCNY(quote.total)} · 费用归属：
            {mainName} · {quote.costMode === 'split' ? '均分' : '主会员承担'}
          </span>
        </div>
        <button className="btn sm danger" onClick={() => onDelete(quote)}>
          删除
        </button>
      </div>

      <div className="joint-quote-items">
        {quote.items.length === 0 ? (
          <span className="muted">关联会员已删除</span>
        ) : (
          quote.items.map((item) => (
            <span className="joint-quote-item" key={item.subscriptionId}>
              {item.serviceName}
              <em>
                {formatDuration(item.durationDays)} · 分摊 {formatCNY(item.amount)}
                {item.monthly === null ? '' : ` · 当前 ${formatCNY(item.monthly)}/月`}
              </em>
            </span>
          ))
        )}
      </div>

      <div className="joint-quote-compare">
        <div className="quote-compare-cell">
          <span>当前组合总价</span>
          <strong>{formatCNY(currentTotal)}</strong>
        </div>
        <div className="quote-compare-cell">
          <span>捆绑包总价</span>
          <strong>{formatCNY(quote.total)}</strong>
        </div>
        <div className="quote-compare-cell">
          <span>差额</span>
          {diff === null ? (
            <span className="muted">—</span>
          ) : diff < 0 ? (
            <span className="badge ok">省 {formatCNY(-diff)}</span>
          ) : diff > 0 ? (
            <span className="badge warn">贵 {formatCNY(diff)}</span>
          ) : (
            <span className="badge muted">持平</span>
          )}
        </div>
      </div>

      {excluded > 0 ? (
        <p className="joint-hint">
          有 {excluded} 个会员没有可比的月均成本，未计入对比。
        </p>
      ) : null}
      {quote.note ? <p className="joint-hint">{quote.note}</p> : null}
    </article>
  )
}
