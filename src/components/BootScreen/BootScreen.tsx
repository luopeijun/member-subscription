import './BootScreen.scss'

type BootScreenProps = {
  error: string | null
  onRetry: () => void
}

export function BootScreen({ error, onRetry }: BootScreenProps) {
  if (error) {
    return (
      <div className="boot">
        <div className="card card-pad boot-card">
          <h1>加载失败</h1>
          <p className="muted">{error}</p>
          <button className="btn primary" onClick={onRetry}>
            重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="boot">
      <div className="spinner" />
      <p className="muted">正在读取本地数据…</p>
    </div>
  )
}
