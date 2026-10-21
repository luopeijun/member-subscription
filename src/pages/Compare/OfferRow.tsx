import type { Snapshot } from '@/types'
import { formatCNY } from '@shared/money'
import { formatDay } from '@/utils/format'
import { snapshotDurationLabel, snapshotMonthly } from '@/utils/snapshot'
import './OfferRow.scss'

type OfferRowProps = {
  offer: Snapshot
  myMonthly: number | null
  myPlatform: string | undefined
  lowestMonthly: number | null
  onEdit: (snapshot: Snapshot) => void
  onDelete: (snapshot: Snapshot) => void
}

export function OfferRow({
  offer,
  myMonthly,
  myPlatform,
  lowestMonthly,
  onEdit,
  onDelete,
}: OfferRowProps) {
  const monthly = snapshotMonthly(offer)
  const term = snapshotDurationLabel(offer)
  const diff = monthly !== null && myMonthly !== null ? monthly - myMonthly : null
  const isCurrent =
    Boolean(myPlatform) &&
    (offer.platform ?? '').trim().toLowerCase() ===
      (myPlatform ?? '').trim().toLowerCase()
  const isLowest = monthly !== null && monthly === lowestMonthly

  return (
    <div className={`offer-row ${isLowest ? 'lowest' : ''}`}>
      <span className="offer-platform">
        {offer.platform ?? '未标注'}
        {isCurrent ? <span className="badge info">当前</span> : null}
        {isLowest ? <span className="badge ok">最低</span> : null}
      </span>
      <span className="offer-price">
        {formatCNY(offer.price)}
        <small> / {term}</small>
      </span>
      <span className="offer-monthly">
        {monthly !== null ? `${formatCNY(monthly)}/月` : '—'}
      </span>
      <span>
        {diff === null ? (
          <span className="muted">—</span>
        ) : diff < 0 ? (
          <span className="badge ok">省 {formatCNY(-diff)}/月</span>
        ) : diff > 0 ? (
          <span className="badge warn">贵 {formatCNY(diff)}/月</span>
        ) : (
          <span className="badge muted">持平</span>
        )}
      </span>
      <span className="offer-date">{formatDay(offer.capturedAt)}</span>
      <span className="offer-duration">{snapshotDurationLabel(offer)}</span>
      <span className="offer-note">{offer.note ?? '—'}</span>
      <span className="offer-actions">
        <button className="btn sm" onClick={() => onEdit(offer)}>
          编辑
        </button>
        <button className="btn sm danger" onClick={() => onDelete(offer)}>
          删除
        </button>
      </span>
    </div>
  )
}
