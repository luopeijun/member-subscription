import { useMemo, useState, type FormEvent } from 'react'
import { api } from '../api'
import type { AppState, JointCostMode, Subscription } from '../types'
import { formatCNY, toMinor } from '../../shared/money'
import { CYCLE_OPTIONS, Modal, formatDate } from './ui'

function addMonths(value: string, months: number): string {
  const [year, month, day] = value.split('-').map(Number)
  const targetIndex = month - 1 + months
  const targetYear = year + Math.floor(targetIndex / 12)
  const targetMonth = ((targetIndex % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const targetDay = Math.min(day, lastDay)
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(
    targetDay,
  ).padStart(2, '0')}`
}

type Props = {
  state: AppState
  onClose: () => void
  onSaved: (next: AppState, message: string) => void
}

export function JointRenewForm({ state, onClose, onSaved }: Props) {
  const [memberIds, setMemberIds] = useState<number[]>([])
  const [mainId, setMainId] = useState<number | null>(null)
  const [picker, setPicker] = useState('')
  const [total, setTotal] = useState('')
  const [paidAt, setPaidAt] = useState(state.today)
  const [cycleMonths, setCycleMonths] = useState(12)
  const [costMode, setCostMode] = useState<JointCostMode>('split')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const selectedMembers = useMemo(
    () =>
      memberIds
        .map((id) => state.subscriptions.find((sub) => sub.id === id))
        .filter((sub): sub is Subscription => Boolean(sub)),
    [memberIds, state.subscriptions],
  )

  const options = useMemo(
    () =>
      [...state.subscriptions]
        .filter((sub) => !memberIds.includes(sub.id))
        .sort((a, b) => a.serviceName.localeCompare(b.serviceName, 'zh-CN')),
    [state.subscriptions, memberIds],
  )

  const totalFen =
    total === '' || !Number.isFinite(Number(total)) ? 0 : toMinor(Number(total))
  const share =
    selectedMembers.length > 0 ? Math.floor(totalFen / selectedMembers.length) : 0
  const remainder =
    selectedMembers.length > 0 ? totalFen - share * selectedMembers.length : 0
  const mainMember = selectedMembers.find((sub) => sub.id === mainId) ?? null

  const addMember = () => {
    const id = Number(picker)
    if (!id) return
    setMemberIds((current) => [...current, id])
    if (mainId === null) setMainId(id)
    setPicker('')
    setError('')
  }

  const removeMember = (id: number) => {
    const next = memberIds.filter((item) => item !== id)
    setMemberIds(next)
    if (mainId === id) setMainId(next[0] ?? null)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (selectedMembers.length < 2) {
      setError('联合续费至少选择两个会员；单个会员请用卡片上的「记一笔续费」')
      return
    }
    if (mainId === null) {
      setError('请选择费用归属会员')
      return
    }
    if (total === '' || !Number.isFinite(Number(total)) || Number(total) < 0) {
      setError('请填写本次购买总金额')
      return
    }
    if (cycleMonths === 0) {
      setError('联合续费周期必须大于 0')
      return
    }

    setBusy(true)
    try {
      const next = await api<AppState>('/joint-renewals', {
        method: 'POST',
        body: JSON.stringify({
          memberIds,
          mainSubscriptionId: mainId,
          total: totalFen,
          paidAt,
          cycleMonths,
          costMode,
          note,
        }),
      })
      onSaved(next, '联合续费已记录')
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="联合续费"
      subtitle="一次购买，多个会员一起顺延；会员本身仍然独立"
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="field">
          <label>参与本次续费的会员</label>
          <div className="joint-add-row">
            <select
              value={picker}
              onChange={(event) => setPicker(event.target.value)}
            >
              <option value="">选择要添加的会员</option>
              {options.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.serviceName} · {sub.planName}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn"
              onClick={addMember}
              disabled={!picker}
            >
              添加
            </button>
          </div>
          <p className="joint-hint">
            所有会员都可以自由组合。这次一起买，不代表以后必须一起续。
          </p>
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label>已添加的会员</label>
          {selectedMembers.length === 0 ? (
            <p className="joint-hint">还没有添加会员。至少添加两个才能记录联合续费。</p>
          ) : (
            <div className="joint-members">
              {selectedMembers.map((sub) => {
                const isMain = sub.id === mainId
                const amount =
                  costMode === 'main'
                    ? isMain
                      ? totalFen
                      : 0
                    : share + (isMain ? remainder : 0)
                const nextDate = sub.nextRenewalAt
                  ? addMonths(sub.nextRenewalAt, cycleMonths)
                  : addMonths(paidAt, cycleMonths)
                return (
                  <div key={sub.id} className="joint-member picked">
                    <div className="joint-member-main">
                      <strong>
                        {sub.serviceName}
                        {isMain ? ' · 主会员' : ''}
                      </strong>
                      <span>
                        {sub.planName} · 到期 {formatDate(sub.nextRenewalAt)} →{' '}
                        {formatDate(nextDate)}
                      </span>
                    </div>
                    <span className="joint-member-cost">{formatCNY(amount)}</span>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => removeMember(sub.id)}
                    >
                      移除
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="form-grid" style={{ marginTop: 14 }}>
          <div className="field">
            <label>本次总金额（元）*</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={total}
              placeholder="0.00"
              onChange={(event) => setTotal(event.target.value)}
            />
          </div>
          <div className="field">
            <label>支付日期</label>
            <input
              type="date"
              value={paidAt}
              onChange={(event) => setPaidAt(event.target.value)}
            />
          </div>
          <div className="field">
            <label>续费周期</label>
            <select
              value={cycleMonths}
              onChange={(event) => setCycleMonths(Number(event.target.value))}
            >
              {CYCLE_OPTIONS.filter((option) => option.value > 0).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>费用归属</label>
            <select
              value={costMode}
              onChange={(event) => setCostMode(event.target.value as JointCostMode)}
            >
              <option value="split">均分</option>
              <option value="main">主会员承担</option>
            </select>
          </div>
          <div className="field span-2">
            <label>主会员</label>
            <select
              value={mainId ?? ''}
              onChange={(event) => setMainId(Number(event.target.value))}
              disabled={selectedMembers.length === 0}
            >
              <option value="">选择费用归属会员</option>
              {selectedMembers.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.serviceName} · {sub.planName}
                </option>
              ))}
            </select>
          </div>
          <div className="field span-2">
            <label>备注</label>
            <input
              value={note}
              placeholder="选填，例如平台优惠、代付说明"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>

        <div className="joint-hint" style={{ marginTop: 10 }}>
          你仍然是实际付款人；这里的主会员只决定这笔钱记在谁的账上。均分时余数记在主会员，选择「主会员承担」时全部记在主会员。
        </div>

        <div className="joint-summary">
          本次共 {selectedMembers.length} 个会员，合计 {formatCNY(totalFen)}
          {selectedMembers.length === 0
            ? ''
            : costMode === 'split'
              ? ` · 均分，余数记在${mainMember?.serviceName ?? '主会员'}`
              : ` · 全部记在${mainMember?.serviceName ?? '主会员'}`}
        </div>

        {error ? <div className="form-error">{error}</div> : null}

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button
            type="submit"
            className="btn primary"
            disabled={busy || selectedMembers.length < 2 || mainId === null}
          >
            {busy ? '保存中…' : '记录联合续费'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
