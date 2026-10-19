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

export type JointChild = {
  id: number
  serviceName: string
  planName: string
  nextRenewalAt: string | null
  status: string
}

export type Subscription = {
  id: number
  planId: number
  serviceName: string
  category: string
  planName: string
  cycleMonths: number
  listPrice: number
  platform: string | null
  account: string | null
  startedAt: string
  nextRenewalOverride: string | null
  autoRenew: boolean
  status: string
  sharedWith: string | null
  note: string | null
  jointParentId: number | null
  jointParentName: string | null
  jointCostMode: JointCostMode
  jointChildren: JointChild[]
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
  jointPurchaseId: string | null
}

export type Snapshot = {
  id: number
  planId: number
  serviceName: string
  planName: string
  cycleMonths: number
  capturedAt: string
  price: number
  platform: string | null
  note: string | null
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
  overdueCount: number
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
  snapshots: Snapshot[]
  stats: Stats
}
