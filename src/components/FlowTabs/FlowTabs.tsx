import './FlowTabs.scss'

export type FlowTabOption<T extends string> = {
  value: T
  label: string
  count: number
}

type FlowTabsProps<T extends string> = {
  value: T
  onChange: (value: T) => void
  tabs: FlowTabOption<T>[]
  ariaLabel: string
}

export function FlowTabs<T extends string>({
  value,
  onChange,
  tabs,
  ariaLabel,
}: FlowTabsProps<T>) {
  return (
    <div className="flow-tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          className={`flow-tab${value === tab.value ? ' active' : ''}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          <span>{tab.count}</span>
        </button>
      ))}
    </div>
  )
}
