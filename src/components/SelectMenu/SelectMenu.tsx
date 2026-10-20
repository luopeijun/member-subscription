import { useEffect, useId, useRef, useState } from 'react'
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
}

export function SelectMenu({
  value,
  options,
  onChange,
  ariaLabel,
  size = 'md',
}: SelectMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])
  const listId = useId()

  const selectedIndex = options.findIndex((option) => option.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    optionRefs.current[selectedIndex >= 0 ? selectedIndex : 0]?.focus()
  }, [open, selectedIndex])

  const close = (restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  const choose = (next: string) => {
    onChange(next)
    close(true)
  }

  const move = (delta: number) => {
    if (options.length === 0) return
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
        : (currentIndex + delta + options.length) % options.length
    optionRefs.current[nextIndex]?.focus()
  }

  return (
    <div className={`select-menu ${size}${open ? ' open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="select-trigger"
        ref={triggerRef}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            move(1)
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            move(-1)
          } else if (event.key === 'Escape') {
            close()
          }
        }}
      >
        <span className="select-value">{selected?.label ?? '请选择'}</span>
        {selected?.meta ? <span className="select-meta">{selected.meta}</span> : null}
        <span className="select-chevron" aria-hidden="true" />
      </button>

      {open ? (
        <div
          className="select-popover"
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          onKeyDown={(event) => {
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
            }
          }}
        >
          {options.map((option, index) => (
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
          ))}
        </div>
      ) : null}
    </div>
  )
}
