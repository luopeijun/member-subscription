import { afterEach, describe, expect, it, vi } from 'vitest'
import { readStoredTab, storeTab } from '@/utils/tab'

const TAB_KEY = 'subledger.tab'

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  const getItem = vi.fn((key: string) => values.get(key) ?? null)
  const setItem = vi.fn((key: string, value: string) => {
    values.set(key, value)
  })
  return { storage: { getItem, setItem }, getItem, setItem }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readStoredTab', () => {
  it('restores a valid saved tab', () => {
    const { storage } = createStorage({ [TAB_KEY]: 'payments' })
    vi.stubGlobal('window', { localStorage: storage })

    expect(readStoredTab()).toBe('payments')
  })

  it('falls back to the dashboard when nothing is saved', () => {
    const { storage } = createStorage()
    vi.stubGlobal('window', { localStorage: storage })

    expect(readStoredTab()).toBe('dashboard')
  })

  it('falls back to the dashboard for an unknown tab', () => {
    const { storage } = createStorage({ [TAB_KEY]: 'unknown' })
    vi.stubGlobal('window', { localStorage: storage })

    expect(readStoredTab()).toBe('dashboard')
  })

  it('falls back to the dashboard when storage is unavailable', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('denied')
        },
      },
    })

    expect(readStoredTab()).toBe('dashboard')
  })
})

describe('storeTab', () => {
  it('saves the active tab', () => {
    const { storage, setItem } = createStorage()
    vi.stubGlobal('window', { localStorage: storage })

    storeTab('compare')

    expect(setItem).toHaveBeenCalledWith(TAB_KEY, 'compare')
  })

  it('ignores storage write failures', () => {
    vi.stubGlobal('window', {
      localStorage: {
        setItem: () => {
          throw new Error('denied')
        },
      },
    })

    expect(() => storeTab('subscriptions')).not.toThrow()
  })
})
