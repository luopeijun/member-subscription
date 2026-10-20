import { TABS, type Tab } from '@/constants'
import './Topbar.scss'

type TopbarProps = {
  tab: Tab
  onTabChange: (tab: Tab) => void
}

export function Topbar({ tab, onTabChange }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="brand" onClick={() => onTabChange('dashboard')}>
          <span className="brand-mark">¥</span>
          <span className="brand-text">
            <strong>会员订阅</strong>
          </span>
        </button>

        <nav className="nav">
          {TABS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${tab === item.id ? 'active' : ''}`}
              onClick={() => onTabChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}
