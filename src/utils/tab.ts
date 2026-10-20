import { TABS, type Tab } from '@/constants'

const TAB_KEY = 'subledger.tab'

export function readStoredTab(): Tab {
  try {
    const saved = window.localStorage.getItem(TAB_KEY)
    if (TABS.some((item) => item.id === saved)) return saved as Tab
  } catch {
    // localStorage 不可用时退回总览
  }
  return 'dashboard'
}

export function storeTab(tab: Tab): void {
  try {
    window.localStorage.setItem(TAB_KEY, tab)
  } catch {
    // 忽略隐私模式下的写入失败
  }
}
