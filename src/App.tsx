import { useEffect, useState, type ChangeEvent } from 'react'
import { api } from '@/api'
import type {
  AppState,
  JointQuote,
  JointRenewal,
  Payment,
  Plan,
  Snapshot,
  Subscription,
} from '@/types'
import { PAGE_META, type Tab } from '@/constants'
import { Dashboard } from '@/pages/Dashboard/Dashboard'
import { Subscriptions } from '@/pages/Subscriptions/Subscriptions'
import { Payments } from '@/pages/Payments/Payments'
import { Compare } from '@/pages/Compare/Compare'
import { AppFooter } from '@/components/AppFooter/AppFooter'
import { AppModals, type ModalState } from '@/components/AppModals/AppModals'
import { BootScreen } from '@/components/BootScreen/BootScreen'
import { PageHeader } from '@/components/PageHeader/PageHeader'
import { ResetDataDialog } from '@/components/ResetDataDialog/ResetDataDialog'
import { Toast, type ToastKind } from '@/components/Toast/Toast'
import { Topbar } from '@/components/Topbar/Topbar'
import { formatImportSummary, type ImportSummary } from '@/utils/import'
import { readStoredTab, storeTab } from '@/utils/tab'
import './App.scss'

type ToastState = { message: string; kind: ToastKind }

export default function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>(readStoredTab)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
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

  // 记住当前页面：保存、刷新、甚至开发时热重载后都留在原地。
  useEffect(() => {
    storeTab(tab)
  }, [tab])

  const notify = (message: string, kind: ToastKind = 'ok') => {
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
      notify(formatImportSummary(next.imported))
    } catch (error) {
      notify(`导入失败：${(error as Error).message}`, 'err')
    }
  }

  if (loadError || !state) {
    return <BootScreen error={loadError} onRetry={() => void load()} />
  }

  const meta = PAGE_META[tab]

  return (
    <div className="app">
      <Topbar tab={tab} onTabChange={setTab} />

      <main className="container">
        <PageHeader title={meta.title} subtitle={meta.subtitle} today={state.today} />

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

        <AppFooter
          onImport={(event) => void handleImportFile(event)}
          onExport={handleExportData}
          onReset={openReset}
        />
      </main>

      <AppModals
        state={state}
        modal={modal}
        onClose={closeModal}
        onSaved={handleSaved}
      />

      <ResetDataDialog
        state={state}
        open={resetOpen}
        acknowledged={resetAck}
        busy={resetting}
        onAcknowledgedChange={setResetAck}
        onConfirm={() => void handleReset()}
        onClose={() => setResetOpen(false)}
      />

      {toast ? <Toast message={toast.message} kind={toast.kind} /> : null}
    </div>
  )
}
