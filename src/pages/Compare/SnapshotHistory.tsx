import type { Snapshot } from '@/types'
import { formatCNY } from '@shared/money'
import { formatDuration } from '@shared/duration'
import { formatDay } from '@/utils/format'
import './SnapshotHistory.scss'

type SnapshotHistoryProps = {
  snapshots: Snapshot[]
  onDelete: (snapshot: Snapshot) => void
}

export function SnapshotHistory({ snapshots, onDelete }: SnapshotHistoryProps) {
  if (snapshots.length === 0) return null

  return (
    <section className="card card-pad">
      <div className="card-head">
        <div>
          <h2>全部报价记录</h2>
          <p>同一个平台只展示最新一条在主视图，这里可以查看和清理历史</p>
        </div>
      </div>
      <div className="history-list">
        {snapshots.map((snapshot) => (
          <div className="history-row" key={snapshot.id}>
            <span className="history-date">{formatDay(snapshot.capturedAt)}</span>
            <span className="history-platform">{snapshot.platform ?? '未标注'}</span>
            <div className="history-main">
              <strong>
                {snapshot.serviceName} · {snapshot.planName}
              </strong>
              <span>
                {snapshot.note ?? '—'}
                {snapshot.durationDays !== null && snapshot.durationDays > 0
                  ? ` · 总时长 ${formatDuration(snapshot.durationDays)}`
                  : ''}
              </span>
            </div>
            <span className="history-price">{formatCNY(snapshot.price)}</span>
            <button className="btn sm danger" onClick={() => onDelete(snapshot)}>
              删除
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
