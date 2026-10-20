export type Service = {
  id: number
  name: string
  category: string
}

export type Plan = {
  id: number
  serviceId: number
  serviceName: string
  category: string
  name: string
  cycleMonths: number
  cycleDays: number | null
  listPrice: number
  note: string | null
  subscribed: boolean
}

export type PaymentLite = {
  id: number
  paidAt: string
  amount: number
}

export type JointCostMode = 'split' | 'main'

export type JointRenewalMember = {
  subscriptionId: number
  serviceName: string
  planName: string
  amount: number
  durationDays: number
}

export type JointRenewal = {
  id: number
  mainSubscriptionId: number | null
  mainServiceName: string | null
  paidAt: string
  total: number
  cycleMonths: number
  costMode: JointCostMode
  note: string | null
  members: JointRenewalMember[]
}

export type Subscription = {
  id: number
  planId: number
  serviceName: string
  category: string
  planName: string
  cycleMonths: number
  cycleDays: number | null
  listPrice: number
  platform: string | null
  account: string | null
  startedAt: string
  nextRenewalOverride: string | null
  autoRenew: boolean
  status: string
  note: string | null
  lastPayment: PaymentLite | null
  prevPayment: PaymentLite | null
  nextRenewalAt: string | null
  daysLeft: number | null
  annualized: number
  totalSpent: number
  paymentCount: number
  priceChangePct: number | null
}

export type Payment = {
  id: number
  subscriptionId: number
  serviceName: string
  planName: string
  paidAt: string
  amount: number
  note: string | null
  jointRenewalId: number | null
}

export type Snapshot = {
  id: number
  planId: number
  serviceName: string
  planName: string
  cycleMonths: number
  cycleDays: number | null
  capturedAt: string
  durationDays: number | null
  price: number
  platform: string | null
  note: string | null
}

export type JointQuoteItem = {
  subscriptionId: number
  serviceName: string
  planName: string
  durationDays: number
  amount: number
  monthly: number | null
}

export type JointQuote = {
  id: number
  capturedAt: string
  total: number
  cycleMonths: number
  mainSubscriptionId: number | null
  costMode: JointCostMode
  platform: string | null
  note: string | null
  items: JointQuoteItem[]
}

export type Upcoming = {
  subscriptionId: number
  serviceName: string
  planName: string
  date: string
  daysLeft: number
  amount: number
  platform: string | null
  autoRenew: boolean
}

export type Stats = {
  activeCount: number
  annualized: number
  monthly: number
  totalSpent: number
  upcoming30: number
  expiredCount: number
  categories: { category: string; annualized: number; count: number }[]
  monthlySpend: { month: string; total: number }[]
  upcoming: Upcoming[]
}

export type AppState = {
  today: string
  services: Service[]
  plans: Plan[]
  subscriptions: Subscription[]
  payments: Payment[]
  jointRenewals: JointRenewal[]
  snapshots: Snapshot[]
  jointQuotes: JointQuote[]
  stats: Stats
}

export type SavedHandler = (next: AppState, message: string) => void
