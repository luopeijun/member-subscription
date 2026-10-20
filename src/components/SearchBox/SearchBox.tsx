import './SearchBox.scss'

type SearchBoxProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  ariaLabel?: string
}

export function SearchBox({
  value,
  onChange,
  placeholder,
  ariaLabel = placeholder,
}: SearchBoxProps) {
  return (
    <div className="search-box">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      {value ? (
        <button
          type="button"
          className="search-clear"
          onClick={() => onChange('')}
          aria-label="清除搜索"
        >
          ×
        </button>
      ) : null}
    </div>
  )
}
