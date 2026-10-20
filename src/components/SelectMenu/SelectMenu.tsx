import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import './SelectMenu.scss'

export type SelectMenuOption = {
  value: string
  label: string
  meta?: string
}

type SelectMenuProps = {
  value: string
  options: SelectMenuOption[]
  onChange: (value: string) => void
  ariaLabel: string
  size?: 'md' | 'sm'
  searchable?: boolean
  searchPlaceholder?: string
}

export function SelectMenu({
  value,
  options,
  onChange,
  ariaLabel,
  size = 'md',
  searchable = false,
  searchPlaceholder = '搜索',
}: SelectMenuProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])
  const listId = useId()

  const selectedIndex = options.findIndex((option) => option.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined
  const trimmedQuery = query.trim().toLowerCase()
  const filteredOptions =
    searchable && trimmedQuery
      ? options.filter((option) =>
          `${option.label} ${option.meta ?? ''}`.toLowerCase().includes(trimmedQuery),
        )
      : options
  const selectedFilteredIndex = filteredOptions.findIndex(
    (option) => option.value === value,
  )

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    if (searchable) {
      searchRef.current?.focus()
      return
    }
    optionRefs.current[selectedFilteredIndex >= 0 ? selectedFilteredIndex : 0]?.focus()
  }, [open, selectedFilteredIndex, searchable])

  const close = (restoreFocus = false) => {
    setOpen(false)
    setQuery('')
    if (restoreFocus) triggerRef.current?.focus()
  }

  const choose = (next: string) => {
    onChange(next)
    close(true)
  }

  const move = (delta: number) => {
    if (filteredOptions.length === 0) return
    if (!open) {
      setOpen(true)
      return
    }

    const currentIndex = optionRefs.current.findIndex(
      (option) => option === document.activeElement,
    )
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + delta + filteredOptions.length) % filteredOptions.length
    optionRefs.current[nextIndex]?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close(true)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      move(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      move(-1)
    } else if (event.key === 'Tab') {
      close()
    } else if (
      event.key === 'Enter' &&
      searchable &&
      document.activeElement === searchRef.current
    ) {
      event.preventDefault()
      const first = filteredOptions[0]
      if (first) choose(first.value)
    }
  }

  return (
    <div
      className={`select-menu ${size}${open ? ' open' : ''}${searchable ? ' searchable' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        className="select-trigger"
        ref={triggerRef}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => {
          if (open) {
            close()
          } else {
            setOpen(true)
          }
        }}
        onKeyDown={handleKeyDown}
      >
        <span className="select-value">{selected?.label ?? '请选择'}</span>
        {selected?.meta ? <span className="select-meta">{selected.meta}</span> : null}
        <span className="select-chevron" aria-hidden="true" />
      </button>

      {open ? (
        <div className="select-popover">
          {searchable ? (
            <div className="select-search">
              <input
                ref={searchRef}
                type="text"
                value={query}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                autoComplete="off"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          ) : null}
          <div
            className="select-options"
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            onKeyDown={handleKeyDown}
          >
            {filteredOptions.length === 0 ? (
              <div className="select-empty">没有匹配项</div>
            ) : (
              filteredOptions.map((option, index) => (
                <button
                  key={option.value}
                  ref={(element) => {
                    optionRefs.current[index] = element
                  }}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={`select-option${option.value === value ? ' selected' : ''}`}
                  onClick={() => choose(option.value)}
                >
                  <span className="select-option-label">{option.label}</span>
                  {option.meta ? (
                    <span className="select-option-meta">{option.meta}</span>
                  ) : null}
                  <span className="select-option-check" aria-hidden="true">
                    ✓
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
