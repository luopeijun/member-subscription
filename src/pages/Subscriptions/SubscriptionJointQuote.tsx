import { useState } from 'react'
import type { MemberJointQuoteEntry } from '@/utils/jointQuote'
import { formatCNY } from '@shared/money'
import { formatDay } from '@/utils/format'
import './SubscriptionJointQuote.scss'

type SubscriptionJointQuoteProps = {
  entries: MemberJointQuoteEntry[]
}

function JointQuoteEntry({ entry }: { entry: MemberJointQuoteEntry }) {
  const { quote, item, companions, allocatedMonthly, diff } = entry
  const currentMonthly = item.monthly

  return (
    <div className="sub-joint-entry">
      <div className="sub-joint-meta">
        <strong>{quote.platform ?? '未标注'}</strong>
        <span>{formatDay(quote.capturedAt)}</span>
        <span>整包 {formatCNY(quote.total)}</span>
      </div>

      <div className="sub-joint-metrics">
        <div>
          <span>分摊后</span>
          <strong>
            {allocatedMonthly === null ? '—' : `${formatCNY(allocatedMonthly)}/月`}
          </strong>
        </div>
        <div>
          <span>当前</span>
          <strong>
            {currentMonthly === null ? '—' : `${formatCNY(currentMonthly)}/月`}
          </strong>
        </div>
        <div>
          <span>对比</span>
          {diff === null ? (
            <span className="muted">—</span>
          ) : diff < 0 ? (
            <span className="badge ok">省 {formatCNY(-diff)}/月</span>
          ) : diff > 0 ? (
            <span className="badge warn">贵 {formatCNY(diff)}/月</span>
          ) : (
            <span className="badge muted">持平</span>
          )}
        </div>
      </div>

      <div className="sub-joint-companions">
        <span className="sub-joint-companions-label">同捆</span>
        {companions.length === 0 ? (
          <span className="muted">无其他会员</span>
        ) : (
          companions.map((companion) => (
            <span className="sub-joint-companion" key={companion.subscriptionId}>
              {companion.serviceName} · {companion.planName}
            </span>
          ))
        )}
      </div>
    </div>
  )
}

export function SubscriptionJointQuote({ entries }: SubscriptionJointQuoteProps) {
  const [expanded, setExpanded] = useState(false)

  if (entries.length === 0) return null

  const visibleEntries = expanded ? entries : entries.slice(0, 1)

  return (
    <section className="sub-joint">
      <div className="sub-joint-head">
        <span className="sub-joint-title">联合报价</span>
        <span className="sub-joint-hint">按分摊后等效金额从省到贵</span>
        {entries.length > 1 ? (
          <button
            type="button"
            className="btn sm sub-joint-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? '收起' : `共 ${entries.length} 条`}
          </button>
        ) : null}
      </div>

      <div className="sub-joint-list">
        {visibleEntries.map((entry) => (
          <JointQuoteEntry
            key={`${entry.quote.id}-${entry.item.subscriptionId}`}
            entry={entry}
          />
        ))}
      </div>
    </section>
  )
}
