import { useEffect, useState, type ChangeEvent } from 'react'
import { api } from './api'
import type {
  AppState,
  JointQuote,
  JointRenewal,
  Payment,
  Plan,
  Snapshot,
  Subscription,
} from './types'
import { Dashboard } from './pages/Dashboard'
import { Subscriptions } from './pages/Subscriptions'
import { Payments } from './pages/Payments'
import { Compare } from './pages/Compare'
import {
  JointQuoteForm,
  PaymentForm,
  PlanForm,
  SnapshotForm,
  SubscriptionForm,
} from './components/forms'
import { JointRenewForm } from './components/JointRenewForm'
import { ConfirmDialog } from './components/ui'

type Tab = 'dashboard' | 'subscriptions' | 'payments' | 'compare'

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: '总览' },
  { id: 'subscriptions', label: '会员' },
  { id: 'payments', label: '流水' },
  { id: 'compare', label: '比价' },
]

const PAGE_META: Record<Tab, { title: string; subtitle: string }> = {
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

type ModalState =
  | { kind: 'add' }
  | { kind: 'edit'; subscription: Subscription }
  | { kind: 'renew'; subscription: Subscription }
  | { kind: 'jointRenew' }
  | { kind: 'payment' }
  | { kind: 'snapshot'; plan: Plan }
  | { kind: 'plan' }
  | { kind: 'jointQuote' }
  | null

type Toast = { message: string; kind: 'ok' | 'err' }

type ImportSummary = {
  servicesAdded: number
  plansAdded: number
  subscriptionsAdded: number
  jointRenewalsAdded: number
  jointQuotesAdded: number
  paymentsAdded: number
  snapshotsAdded: number
}

export default function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [modal, setModal] = useState<ModalState>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetAck, setResetAck] = useState(false)
  const [resetting, setResetting] = useState(false)

  const load = async () => {
    setLoadError(null)
    try {
      setState(await api<AppState>('/state'))
    } catch (error) {
      setLoadError((error as Error).message)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const notify = (message: string, kind: Toast['kind'] = 'ok') => {
    setToast({ message, kind })
  }

  const closeModal = () => setModal(null)

  const handleSaved = (next: AppState, message: string) => {
    setState(next)
    setModal(null)
    notify(message)
  }

  const handleDeleteSubscription = async (subscription: Subscription) => {
    if (
      !window.confirm(
        `删除「${subscription.serviceName} · ${subscription.planName}」？\n相关支付流水会一并删除，且无法恢复。`,
      )
    ) {
      return
    }
    try {
      setState(await api<AppState>(`/subscriptions/${subscription.id}`, { method: 'DELETE' }))
      notify('已删除会员')
    } catch (error) {
      notify((error as Error).message, 'err')
    }
  }

  const handleDeletePayment = async (payment: Payment) => {
    if (
      !window.confirm(
        `删除 ${payment.paidAt} 的支付记录？\n${payment.serviceName} · ${payment.planName}`,
      )
    ) {
      return
    }
    try {
      setState(await api<AppState>(`/payments/${payment.id}`, { method: 'DELETE' }))
      notify('已删除支付记录')
    } catch (error) {
      notify((error as Error).message, 'err')
    }
  }

  const handleDeleteJointRenewal = async (jointRenewal: JointRenewal) => {
    if (
      !window.confirm(
        `删除 ${jointRenewal.paidAt} 的联合续费记录？\n会同时删除关联的 ${jointRenewal.members.length} 笔支付，但不会回退会员到期日。`,
      )
    ) {
      return
    }
    try {
      setState(
        await api<AppState>(`/joint-renewals/${jointRenewal.id}`, {
          method: 'DELETE',
        }),
      )
      notify('已删除联合续费记录')
    } catch (error) {
      notify((error as Error).message, 'err')
    }
  }

  const handleDeletePlan = async (plan: Plan) => {
    if (!window.confirm(`删除候选套餐「${plan.serviceName} · ${plan.name}」及其比价记录？`)) {
      return
    }
    try {
      setState(await api<AppState>(`/plans/${plan.id}`, { method: 'DELETE' }))
      notify('已删除套餐')
    } catch (error) {
      notify((error as Error).message, 'err')
    }
  }

  const handleDeleteSnapshot = async (snapshot: Snapshot) => {
    if (
      !window.confirm(
        `删除「${snapshot.platform ?? '未标注'}」在 ${snapshot.capturedAt} 记录的报价？`,
      )
    ) {
      return
    }
    try {
      setState(await api<AppState>(`/snapshots/${snapshot.id}`, { method: 'DELETE' }))
      notify('已删除报价')
    } catch (error) {
      notify((error as Error).message, 'err')
    }
  }

  const handleDeleteJointQuote = async (jointQuote: JointQuote) => {
    if (
      !window.confirm(
        `删除「${jointQuote.platform ?? '未标注'}」在 ${jointQuote.capturedAt} 记录的联合报价？`,
      )
    ) {
      return
    }
    try {
      setState(
        await api<AppState>(`/joint-quotes/${jointQuote.id}`, { method: 'DELETE' }),
      )
      notify('已删除联合报价')
    } catch (error) {
      notify((error as Error).message, 'err')
    }
  }

  const handleSeed = async () => {
    if (state && (state.services.length > 0 || state.plans.length > 0)) {
      notify('已有数据，请先清空后再载入示例数据', 'err')
      return
    }
    try {
      setState(await api<AppState>('/seed', { method: 'POST' }))
      notify('示例数据已载入')
    } catch (error) {
      notify((error as Error).message, 'err')
    }
  }

  const openReset = () => {
    setResetAck(false)
    setResetOpen(true)
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      setState(
        await api<AppState>('/data', {
          method: 'DELETE',
          body: JSON.stringify({ confirm: 'DELETE' }),
        }),
      )
      setResetOpen(false)
      notify('数据已清空')
    } catch (error) {
      notify((error as Error).message, 'err')
    } finally {
      setResetting(false)
    }
  }

  const handleExportData = () => {
    const filename = `subledger-${state?.today ?? 'backup'}.json`
    const link = document.createElement('a')
    link.href = '/api/export/json'
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    notify(`已导出 ${filename}`)
  }

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (
      !window.confirm(
        `导入「${file.name}」？\n数据会以插入方式追加，不会覆盖现有数据。`,
      )
    ) {
      return
    }

    try {
      const text = await file.text()
      let payload: unknown
      try {
        payload = JSON.parse(text)
      } catch {
        throw new Error('文件内容不是有效的 JSON')
      }

      const next = await api<AppState & { imported: ImportSummary }>('/import/json', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setState(next)
      const counts = next.imported
      const parts = [
        `会员 ${counts.subscriptionsAdded} 条`,
        `支付 ${counts.paymentsAdded} 笔`,
        `报价 ${counts.snapshotsAdded} 条`,
      ]
      if (counts.jointRenewalsAdded > 0) {
        parts.push(`联合续费 ${counts.jointRenewalsAdded} 条`)
      }
      if (counts.jointQuotesAdded > 0) {
        parts.push(`联合报价 ${counts.jointQuotesAdded} 条`)
      }
      notify(`导入完成：${parts.join('、')}`)
    } catch (error) {
      notify(`导入失败：${(error as Error).message}`, 'err')
    }
  }

  if (loadError) {
    return (
      <div className="boot">
        <div className="card card-pad boot-card">
          <h1>加载失败</h1>
          <p className="muted">{loadError}</p>
          <button className="btn primary" onClick={() => void load()}>
            重试
          </button>
        </div>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="boot">
        <div className="spinner" />
        <p className="muted">正在读取本地数据…</p>
      </div>
    )
  }

  const meta = PAGE_META[tab]

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <button className="brand" onClick={() => setTab('dashboard')}>
            <span className="brand-mark">¥</span>
            <span className="brand-text">
              <strong>会员订阅</strong>
            </span>
          </button>

          <nav className="nav">
            {TABS.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${tab === item.id ? 'active' : ''}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="container">
        <div className="page-head">
          <div>
            <h1>{meta.title}</h1>
            <p>{meta.subtitle}</p>
          </div>
          <span className="today-pill">今天 {state.today}</span>
        </div>

        {tab === 'dashboard' ? (
          <Dashboard
            state={state}
            onAdd={() => setModal({ kind: 'add' })}
            onSeed={handleSeed}
            onRenew={(subscription) => setModal({ kind: 'renew', subscription })}
          />
        ) : null}

        {tab === 'subscriptions' ? (
          <Subscriptions
            state={state}
            onAdd={() => setModal({ kind: 'add' })}
            onJointRenew={() => setModal({ kind: 'jointRenew' })}
            onEdit={(subscription) => setModal({ kind: 'edit', subscription })}
            onRenew={(subscription) => setModal({ kind: 'renew', subscription })}
            onDelete={(subscription) => void handleDeleteSubscription(subscription)}
          />
        ) : null}

        {tab === 'payments' ? (
          <Payments
            state={state}
            onAdd={() => setModal({ kind: 'payment' })}
            onDelete={(payment) => void handleDeletePayment(payment)}
            onDeleteJointRenewal={(jointRenewal) =>
              void handleDeleteJointRenewal(jointRenewal)
            }
          />
        ) : null}

        {tab === 'compare' ? (
          <Compare
            state={state}
            onAddPlan={() => setModal({ kind: 'plan' })}
            onSnapshot={(plan) => setModal({ kind: 'snapshot', plan })}
            onDeletePlan={(plan) => void handleDeletePlan(plan)}
            onDeleteSnapshot={(snapshot) => void handleDeleteSnapshot(snapshot)}
            onAddJointQuote={() => setModal({ kind: 'jointQuote' })}
            onDeleteJointQuote={(jointQuote) => void handleDeleteJointQuote(jointQuote)}
          />
        ) : null}

        <footer className="app-foot">
          <div className="foot-actions">
            <label className="link-action">
              导入数据
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => void handleImportFile(event)}
              />
            </label>
            <button className="link-action" onClick={handleExportData}>
              导出数据
            </button>
            <button className="link-danger" onClick={openReset}>
              清空全部数据
            </button>
          </div>
        </footer>
      </main>

      {modal?.kind === 'add' ? (
        <SubscriptionForm state={state} onClose={closeModal} onSaved={handleSaved} />
      ) : null}

      {modal?.kind === 'edit' ? (
        <SubscriptionForm
          state={state}
          editing={modal.subscription}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      ) : null}

      {modal?.kind === 'renew' ? (
        <PaymentForm
          state={state}
          subscription={modal.subscription}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      ) : null}

      {modal?.kind === 'jointRenew' ? (
        <JointRenewForm
          state={state}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      ) : null}

      {modal?.kind === 'payment' ? (
        <PaymentForm state={state} onClose={closeModal} onSaved={handleSaved} />
      ) : null}

      {modal?.kind === 'snapshot' ? (
        <SnapshotForm
          plan={modal.plan}
          today={state.today}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      ) : null}

      {modal?.kind === 'plan' ? (
        <PlanForm state={state} onClose={closeModal} onSaved={handleSaved} />
      ) : null}

      {modal?.kind === 'jointQuote' ? (
        <JointQuoteForm state={state} onClose={closeModal} onSaved={handleSaved} />
      ) : null}

      {resetOpen ? (
        <ConfirmDialog
          title="清空全部数据"
          subtitle="此操作不可恢复，请谨慎操作"
          confirmLabel="确认清空"
          confirmDisabled={!resetAck}
          busy={resetting}
          onConfirm={() => void handleReset()}
          onClose={() => setResetOpen(false)}
        >
          <p className="confirm-text">将永久删除以下全部内容：</p>
          <ul className="confirm-list">
            <li>
              <strong>{state.subscriptions.length}</strong> 个会员及其全部支付流水
            </li>
            {state.jointRenewals.length > 0 ? (
              <li>
                <strong>{state.jointRenewals.length}</strong> 条联合续费记录
              </li>
            ) : null}
            {state.snapshots.length + state.jointQuotes.length > 0 ? (
              <li>
                <strong>{state.snapshots.length + state.jointQuotes.length}</strong> 条比价 /
                联合报价
              </li>
            ) : null}
          </ul>
          <p className="confirm-hint">
            清空前会自动在 data/backups 留一份快照；如需自行保管，建议先用底部的「导出数据」备份。
          </p>
          <label className="confirm-check">
            <input
              type="checkbox"
              checked={resetAck}
              onChange={(event) => setResetAck(event.target.checked)}
            />
            <span>我已了解，确认清空全部数据</span>
          </label>
        </ConfirmDialog>
      ) : null}

      {toast ? <div className={`toast ${toast.kind}`}>{toast.message}</div> : null}
    </div>
  )
}
