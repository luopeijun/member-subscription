import type {
  AppState,
  JointQuote,
  JointQuoteItem,
  Plan,
  Service,
  Snapshot,
  Stats,
  Subscription,
} from '@/types'

export function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: 1,
    name: '测试服务',
    category: '其他',
    ...overrides,
  }
}

export function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 1,
    serviceId: 1,
    serviceName: '测试服务',
    category: '其他',
    name: '标准版',
    cycleMonths: 1,
    cycleDays: null,
    listPrice: 1000,
    note: null,
    subscribed: true,
    ...overrides,
  }
}

export function makeSubscription(
  overrides: Partial<Subscription> = {},
): Subscription {
  return {
    id: 1,
    planId: 1,
    serviceName: '测试服务',
    category: '其他',
    planName: '标准版',
    cycleMonths: 1,
    cycleDays: null,
    listPrice: 1000,
    platform: null,
    account: null,
    startedAt: '2026-01-01',
    nextRenewalOverride: null,
    autoRenew: false,
    status: 'active',
    note: null,
    lastPayment: { id: 1, paidAt: '2026-01-01', amount: 1000 },
    prevPayment: null,
    nextRenewalAt: '2026-02-01',
    daysLeft: 31,
    annualized: 12000,
    totalSpent: 1000,
    paymentCount: 1,
    priceChangePct: null,
    ...overrides,
  }
}

export function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    id: 1,
    planId: 1,
    serviceName: '测试服务',
    planName: '标准版',
    cycleMonths: 1,
    cycleDays: null,
    capturedAt: '2026-01-01',
    durationDays: null,
    price: 1000,
    platform: null,
    note: null,
    ...overrides,
  }
}

export function makeJointQuoteItem(
  overrides: Partial<JointQuoteItem> = {},
): JointQuoteItem {
  return {
    subscriptionId: 1,
    serviceName: '测试服务',
    planName: '标准版',
    durationDays: 365,
    amount: 12000,
    monthly: 1000,
    ...overrides,
  }
}

export function makeJointQuote(overrides: Partial<JointQuote> = {}): JointQuote {
  return {
    id: 1,
    capturedAt: '2026-01-01',
    total: 12000,
    cycleMonths: 12,
    mainSubscriptionId: null,
    costMode: 'split',
    platform: null,
    note: null,
    items: [],
    ...overrides,
  }
}

export function makeStats(overrides: Partial<Stats> = {}): Stats {
  return {
    activeCount: 0,
    annualized: 0,
    monthly: 0,
    totalSpent: 0,
    upcoming30: 0,
    expiredCount: 0,
    categories: [],
    monthlySpend: [],
    upcoming: [],
    ...overrides,
  }
}

export function makeAppState(overrides: Partial<AppState> = {}): AppState {
  return {
    today: '2026-10-21',
    services: [],
    plans: [],
    subscriptions: [],
    payments: [],
    jointRenewals: [],
    snapshots: [],
    jointQuotes: [],
    stats: makeStats(),
    ...overrides,
  }
}
