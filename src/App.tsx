import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react'
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
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog'
import { PageHeader } from '@/components/PageHeader/PageHeader'
import { ResetDataDialog } from '@/components/ResetDataDialog/ResetDataDialog'
import { Toast, type ToastKind } from '@/components/Toast/Toast'
import { Topbar } from '@/components/Topbar/Topbar'
import { formatCNY } from '@shared/money'
import { downloadJson } from '@/utils/download'
import { formatDate } from '@/utils/format'
import { formatImportSummary, readJsonFile, type ImportSummary } from '@/utils/import'
import { readStoredTab, storeTab } from '@/utils/tab'
import './App.scss'

type ToastState = { message: string; kind: ToastKind }

type DeleteTarget =
  | { kind: 'payment'; payment: Payment }
  | { kind: 'jointRenewal'; jointRenewal: JointRenewal }
  | { kind: 'plan'; plan: Plan }
  | { kind: 'snapshot'; snapshot: Snapshot }
  | { kind: 'jointQuote'; jointQuote: JointQuote }

export default function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>(readStoredTab)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetAck, setResetAck] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deletingTarget, setDeletingTarget] = useState(false)

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

  const remove = async (path: string, message: string) => {
    try {
      setState(await api<AppState>(path, { method: 'DELETE' }))
      notify(message)
      return true
    } catch (error) {
      notify((error as Error).message, 'err')
      return false
    }
  }

  const handleDeleteSubscription = (subscription: Subscription) => {
    if (
      !window.confirm(
        `删除「${subscription.serviceName} · ${subscription.planName}」？\n相关支付流水会一并删除，且无法恢复。`,
      )
    ) {
      return
    }
    void remove(`/subscriptions/${subscription.id}`, '已删除会员')
  }

  const handleDeletePayment = (payment: Payment) => {
    setDeleteTarget({ kind: 'payment', payment })
  }

  const handleDeleteJointRenewal = (jointRenewal: JointRenewal) => {
    setDeleteTarget({ kind: 'jointRenewal', jointRenewal })
  }

  const handleDeletePlan = (plan: Plan) => {
    setDeleteTarget({ kind: 'plan', plan })
  }

  const handleDeleteSnapshot = (snapshot: Snapshot) => {
    setDeleteTarget({ kind: 'snapshot', snapshot })
  }

  const handleDeleteJointQuote = (jointQuote: JointQuote) => {
    setDeleteTarget({ kind: 'jointQuote', jointQuote })
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeletingTarget(true)
    let removed = false
    switch (deleteTarget.kind) {
      case 'payment':
        removed = await remove(`/payments/${deleteTarget.payment.id}`, '已删除支付记录')
        break
      case 'jointRenewal':
        removed = await remove(
          `/joint-renewals/${deleteTarget.jointRenewal.id}`,
          '已删除联合续费记录',
        )
        break
      case 'plan':
        removed = await remove(`/plans/${deleteTarget.plan.id}`, '已删除套餐')
        break
      case 'snapshot':
        removed = await remove(`/snapshots/${deleteTarget.snapshot.id}`, '已删除报价')
        break
      case 'jointQuote':
        removed = await remove(
          `/joint-quotes/${deleteTarget.jointQuote.id}`,
          '已删除联合报价',
        )
        break
    }
    setDeletingTarget(false)
    if (removed) setDeleteTarget(null)
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
    downloadJson(filename)
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
      const payload = await readJsonFile(file)
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

  const deleteDialog: {
    title: string
    subtitle: string
    confirmLabel: string
    body: ReactNode
  } | null = (() => {
    if (!deleteTarget) return null
    switch (deleteTarget.kind) {
      case 'payment':
        return {
          title: '删除支付记录',
          subtitle: `${deleteTarget.payment.serviceName} · ${deleteTarget.payment.planName}`,
          confirmLabel: '删除支付',
          body: (
            <>
              <p className="confirm-text">将删除这笔支付记录：</p>
              <ul className="confirm-list">
                <li>
                  支付日期 <strong>{deleteTarget.payment.paidAt}</strong>
                </li>
                <li>
                  金额 <strong>{formatCNY(deleteTarget.payment.amount)}</strong>
                </li>
              </ul>
              <p className="confirm-hint">
                删除后会重新计算月均成本和累计支出，但不会主动修改手填的下次续费日。
              </p>
            </>
          ),
        }
      case 'jointRenewal':
        return {
          title: '删除联合续费记录',
          subtitle: `${formatDate(deleteTarget.jointRenewal.paidAt)} · ${deleteTarget.jointRenewal.members.length} 个会员`,
          confirmLabel: '删除联合续费',
          body: (
            <>
              <p className="confirm-text">
                将删除这条联合续费记录，以及关联的{' '}
                {deleteTarget.jointRenewal.members.length} 笔支付：
              </p>
              <ul className="confirm-list">
                <li>
                  合计金额{' '}
                  <strong>{formatCNY(deleteTarget.jointRenewal.total)}</strong>
                </li>
                <li>
                  涉及会员{' '}
                  <strong>
                    {deleteTarget.jointRenewal.members
                      .map((member) => member.serviceName)
                      .join('、')}
                  </strong>
                </li>
              </ul>
              <p className="confirm-hint">
                删除后会重新计算成本统计，但不会主动修改手填的下次续费日。
              </p>
            </>
          ),
        }
      case 'plan':
        return {
          title: '删除套餐',
          subtitle: `${deleteTarget.plan.serviceName} · ${deleteTarget.plan.name}`,
          confirmLabel: '删除套餐',
          body: (
            <>
              <p className="confirm-text">将删除这个套餐及其全部平台报价：</p>
              <ul className="confirm-list">
                <li>
                  服务 <strong>{deleteTarget.plan.serviceName}</strong>
                </li>
                <li>
                  套餐 <strong>{deleteTarget.plan.name}</strong>
                </li>
              </ul>
              <p className="confirm-hint">
                如果该套餐下还有会员记录，系统会阻止删除；需要先处理对应会员。删除后无法恢复。
              </p>
            </>
          ),
        }
      case 'snapshot':
        return {
          title: '删除平台报价',
          subtitle: `${deleteTarget.snapshot.serviceName} · ${deleteTarget.snapshot.planName}`,
          confirmLabel: '删除报价',
          body: (
            <>
              <p className="confirm-text">将删除这条平台报价：</p>
              <ul className="confirm-list">
                <li>
                  平台 <strong>{deleteTarget.snapshot.platform ?? '未标注'}</strong>
                </li>
                <li>
                  记录日期 <strong>{formatDate(deleteTarget.snapshot.capturedAt)}</strong>
                </li>
                <li>
                  价格 <strong>{formatCNY(deleteTarget.snapshot.price)}</strong>
                </li>
              </ul>
              <p className="confirm-hint">
                只会删除这条比价记录，不会影响套餐本身，也不会修改已有支付记录。
              </p>
            </>
          ),
        }
      case 'jointQuote':
        return {
          title: '删除联合报价',
          subtitle: `${deleteTarget.jointQuote.platform ?? '未标注'} · ${formatDate(deleteTarget.jointQuote.capturedAt)} · ${deleteTarget.jointQuote.items.length} 个会员`,
          confirmLabel: '删除联合报价',
          body: (
            <>
              <p className="confirm-text">将删除这条联合报价：</p>
              <ul className="confirm-list">
                <li>
                  捆绑包总价{' '}
                  <strong>{formatCNY(deleteTarget.jointQuote.total)}</strong>
                </li>
                <li>
                  涉及会员{' '}
                  <strong>
                    {deleteTarget.jointQuote.items
                      .map((item) => item.serviceName)
                      .join('、')}
                  </strong>
                </li>
              </ul>
              <p className="confirm-hint">
                只会删除这条比价记录，不会生成或删除支付，也不会改变会员到期日。
              </p>
            </>
          ),
        }
    }
  })()

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
            onDelete={handleDeleteSubscription}
          />
        ) : null}

        {tab === 'payments' ? (
          <Payments
            state={state}
            onDelete={handleDeletePayment}
            onDeleteJointRenewal={handleDeleteJointRenewal}
          />
        ) : null}

        {tab === 'compare' ? (
          <Compare
            state={state}
            onNewQuote={() => setModal({ kind: 'newQuote' })}
            onSnapshot={(plan) => setModal({ kind: 'quote', plan })}
            onDeletePlan={handleDeletePlan}
            onDeleteSnapshot={handleDeleteSnapshot}
            onEditSnapshot={(snapshot) => setModal({ kind: 'editQuote', snapshot })}
            onAddJointQuote={() => setModal({ kind: 'jointQuote' })}
            onEditJointQuote={(jointQuote) =>
              setModal({ kind: 'editJointQuote', jointQuote })
            }
            onDeleteJointQuote={handleDeleteJointQuote}
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

      {deleteDialog ? (
        <ConfirmDialog
          title={deleteDialog.title}
          subtitle={deleteDialog.subtitle}
          confirmLabel={deleteDialog.confirmLabel}
          busy={deletingTarget}
          onConfirm={() => void confirmDelete()}
          onClose={() => {
            if (!deletingTarget) setDeleteTarget(null)
          }}
        >
          {deleteDialog.body}
        </ConfirmDialog>
      ) : null}

      {toast ? <Toast message={toast.message} kind={toast.kind} /> : null}
    </div>
  )
}
