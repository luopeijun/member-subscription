export type Tab = 'dashboard' | 'subscriptions' | 'payments' | 'compare'

export const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: '总览' },
  { id: 'subscriptions', label: '会员' },
  { id: 'payments', label: '流水' },
  { id: 'compare', label: '比价' },
]

export const PAGE_META: Record<Tab, { title: string; subtitle: string }> = {
  dashboard: {
    title: '总览',
    subtitle: '月均成本、到期提醒和现金流，一眼看完',
  },
  subscriptions: {
    title: '会员',
    subtitle: '每个会员的实际价格、周期和下次扣款',
  },
  payments: {
    title: '支付流水',
    subtitle: '每一次续费花了多少钱，都在这里',
  },
  compare: {
    title: '比价',
    subtitle: '我买的价格，和其他平台报的价格',
  },
}

export const CATEGORIES = [
  '影音娱乐',
  '软件工具',
  'AI 服务',
  '云存储',
  '会员权益',
  '教育学习',
  '游戏',
  '其他',
]

export const PLATFORM_SUGGESTIONS = [
  '官网',
  'App Store',
  'Google Play',
  '淘宝',
  '闲鱼',
  '拼车群',
  '其他',
]

export const STATUS_OPTIONS = [
  { value: 'active', label: '活跃' },
  { value: 'planned', label: '想买' },
  { value: 'expired', label: '已过期' },
]
