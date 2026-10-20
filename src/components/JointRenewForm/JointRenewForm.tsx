import { useMemo, useState, type FormEvent } from 'react'
import { api } from '@/api'
import type { AppState, JointCostMode, SavedHandler, Subscription } from '@/types'
import { formatCNY, toMinor } from '@shared/money'
import { addDaysISO, DURATION_PRESETS, formatDuration } from '@shared/duration'
import { clampDurationDays } from '@/utils/duration'
import { Modal } from '@/components/Modal/Modal'
import { SelectMenu } from '@/components/SelectMenu/SelectMenu'
import { formatDate } from '@/utils/format'
import './JointRenewForm.scss'

type JointRenewFormProps = {
  state: AppState
  onClose: () => void
  onSaved: SavedHandler
}

type MemberDraft = {
  id: number
  days: number
}

export function JointRenewForm({ state, onClose, onSaved }: JointRenewFormProps) {
  const [members, setMembers] = useState<MemberDraft[]>([])
  const [mainId, setMainId] = useState<number | null>(null)
  const [picker, setPicker] = useState('')
  const [total, setTotal] = useState('')
  const [paidAt, setPaidAt] = useState(state.today)
  const [defaultDays, setDefaultDays] = useState(365)
  const [costMode, setCostMode] = useState<JointCostMode>('split')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const selectedMembers = useMemo(
    () =>
      members
        .map((draft) => {
          const sub = state.subscriptions.find((item) => item.id === draft.id)
          return sub ? { ...draft, sub } : null
        })
        .filter((item): item is MemberDraft & { sub: Subscription } => Boolean(item)),
    [members, state.subscriptions],
  )

  const options = useMemo(
    () =>
      [...state.subscriptions]
        .filter((sub) => !members.some((member) => member.id === sub.id))
        .sort((a, b) => a.serviceName.localeCompare(b.serviceName, 'zh-CN')),
    [state.subscriptions, members],
  )

  const totalFen =
    total === '' || !Number.isFinite(Number(total)) ? 0 : toMinor(Number(total))
  const totalDays = selectedMembers.reduce((sum, member) => sum + member.days, 0)
  const amounts = selectedMembers.map((member) => {
    if (costMode === 'main') return member.id === mainId ? totalFen : 0
    if (totalDays <= 0) return 0
    return Math.floor((totalFen * member.days) / totalDays)
  })
  if (costMode === 'split' && totalDays > 0) {
    const mainIndex = selectedMembers.findIndex((member) => member.id === mainId)
    if (mainIndex >= 0) {
      const assigned = amounts.reduce((sum, amount) => sum + amount, 0)
      amounts[mainIndex] += totalFen - assigned
    }
  }
  const mainMember = selectedMembers.find((member) => member.id === mainId) ?? null

  const addMember = () => {
    const id = Number(picker)
    if (!id) return
    setMembers((current) => [...current, { id, days: defaultDays }])
    if (mainId === null) setMainId(id)
    setPicker('')
    setError('')
  }

  const removeMember = (id: number) => {
    const next = members.filter((member) => member.id !== id)
    setMembers(next)
    if (mainId === id) setMainId(next[0]?.id ?? null)
  }

  const updateMember = (id: number, days: number) => {
    setMembers((current) =>
      current.map((member) => (member.id === id ? { ...member, days } : member)),
    )
  }

  const applyDefault = () => {
    setMembers((current) =>
      current.map((member) => ({ ...member, days: defaultDays })),
    )
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

    setBusy(true)
    try {
      const next = await api<AppState>('/joint-renewals', {
        method: 'POST',
        body: JSON.stringify({
          members: selectedMembers.map((member) => ({
            subscriptionId: member.id,
            durationDays: member.days,
          })),
          mainSubscriptionId: mainId,
          total: totalFen,
          paidAt,
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
      subtitle="一次购买，多个会员一起顺延；每个会员可以拿不同的天数"
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="field">
          <label>参与本次续费的会员</label>
          <div className="joint-add-row">
            <SelectMenu
              value={picker}
              options={options.map((sub) => ({
                value: String(sub.id),
                label: `${sub.serviceName} · ${sub.planName}`,
              }))}
              onChange={setPicker}
              ariaLabel="选择要添加的会员"
              searchable
              searchPlaceholder="搜索会员"
            />
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
            所有会员可自由组合。联合续费仅记录本次购买，不影响后续是否继续一起续费；每个会员的服务时长可不同。
          </p>
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label>已添加的会员</label>
          {selectedMembers.length === 0 ? (
            <p className="joint-hint">还没有添加会员。至少添加两个才能记录联合续费。</p>
          ) : (
            <div className="joint-members">
              {selectedMembers.map((member, index) => {
                const isMain = member.id === mainId
                const currentNext = member.sub.nextRenewalAt
                const base =
                  member.sub.status !== 'planned' &&
                  currentNext &&
                  currentNext > paidAt
                    ? currentNext
                    : paidAt
                const nextDate = addDaysISO(base, member.days)
                return (
                  <div key={member.id} className="joint-member picked">
                    <div className="joint-member-main">
                      <strong>
                        {member.sub.serviceName}
                        {isMain ? ' · 主会员' : ''}
                      </strong>
                      <span>
                        {member.sub.status === 'planned' ? (
                          <>
                            {member.sub.planName} · 还没买，从 {formatDate(paidAt)} 起{' '}
                            {member.days} 天
                          </>
                        ) : currentNext && currentNext > paidAt ? (
                          <>
                            {member.sub.planName} · 到期{' '}
                            {formatDate(currentNext)} → {formatDate(nextDate)}
                          </>
                        ) : (
                          <>
                            {member.sub.planName} · 已过期，从 {formatDate(paidAt)} 起{' '}
                            {member.days} 天 → {formatDate(nextDate)}
                          </>
                        )}
                      </span>
                    </div>
                    <div className="joint-member-duration">
                      <input
                        type="number"
                        min={1}
                        max={3650}
                        value={member.days}
                        aria-label={`${member.sub.serviceName} 时长（天）`}
                        onChange={(event) =>
                          updateMember(member.id, clampDurationDays(event.target.value))
                        }
                      />
                      <span>天</span>
                    </div>
                    <span className="joint-member-cost">{formatCNY(amounts[index])}</span>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => removeMember(member.id)}
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
          <div className="field span-2">
            <label>默认天数</label>
            <div className="duration-input">
              <input
                type="number"
                min={1}
                max={3650}
                value={defaultDays}
                aria-label="默认天数"
                onChange={(event) => setDefaultDays(clampDurationDays(event.target.value))}
              />
              <span>天</span>
              <button
                type="button"
                className="btn sm"
                onClick={applyDefault}
                disabled={selectedMembers.length === 0}
              >
                应用到全部
              </button>
            </div>
            <div className="duration-presets">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset.days}
                  type="button"
                  className={`btn sm${defaultDays === preset.days ? ' active' : ''}`}
                  onClick={() => setDefaultDays(preset.days)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>费用归属</label>
            <select
              value={costMode}
              onChange={(event) => setCostMode(event.target.value as JointCostMode)}
            >
              <option value="split">均分（按天数）</option>
              <option value="main">主会员承担</option>
            </select>
          </div>
          <div className="field">
            <label>主会员</label>
            <select
              value={mainId ?? ''}
              onChange={(event) => setMainId(Number(event.target.value))}
              disabled={selectedMembers.length === 0}
            >
              <option value="">选择费用归属会员</option>
              {selectedMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.sub.serviceName} · {member.sub.planName}
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
          你仍然是实际付款人；这里的主会员只决定这笔钱记在谁的账上。均分时按每个会员实际拿到的天数分摊，
          余数记在主会员；选择「主会员承担」时全部记在主会员。
        </div>

        <div className="joint-summary">
          本次共 {selectedMembers.length} 个会员，合计 {formatCNY(totalFen)}
          {selectedMembers.length === 0
            ? ''
            : costMode === 'split'
              ? ` · 按天数分摊，余数记在${mainMember?.sub.serviceName ?? '主会员'}`
              : ` · 全部记在${mainMember?.sub.serviceName ?? '主会员'}`}
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
