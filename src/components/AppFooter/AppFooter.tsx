import type { ChangeEvent } from 'react'
import './AppFooter.scss'

type AppFooterProps = {
  onImport: (event: ChangeEvent<HTMLInputElement>) => void
  onExport: () => void
  onReset: () => void
}

export function AppFooter({ onImport, onExport, onReset }: AppFooterProps) {
  return (
    <footer className="app-foot">
      <div className="foot-actions">
        <label className="link-action">
          导入数据
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={onImport}
          />
        </label>
        <button className="link-action" onClick={onExport}>
          导出数据
        </button>
        <button className="link-danger" onClick={onReset}>
          清空全部数据
        </button>
      </div>
    </footer>
  )
}
