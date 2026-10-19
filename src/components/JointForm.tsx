import { useMemo, useState, type FormEvent } from 'react'
import { api } from '../api'
import type { AppState, JointCostMode, Subscription } from '../types'
import { formatCNY } from '../../shared/money'
import { Modal, formatDate } from './ui'

type Props = {
  state: AppState
  main?: Subscription
  onClose: () => void
  onSaved: (next: AppState, message: string) => void
}

export function JointForm({ state, main, onClose, onSaved }: Props) {
  const [mainId, setMainId] = useState<number | null>(main?.id ?? null)
  const [childIds, setChildIds] = useState<number[]>(
    main ? main.jointChildren.map((child) => child.id) : [],
  )
  const [costMode, setCostMode] = useState<JointCostMode>(main?.jointCostMode ?? 'split')
  const [reallocate, setReallocate] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const selectedMain = useMemo(
    () => state.subscriptions.find((sub) => sub.id === mainId) ?? null,
    [state.subscriptions, mainId],
  )

  const mainCandidates = useMemo(
    () =>
      state.subscriptions
        .filter((sub) => sub.jointParentId === null)
        .sort((a, b) => a.serviceName.localeCompare(b.serviceName, 'zh-CN')),
    [state.subscriptions],
  )

  const candidates = useMemo(() => {
    if (!selectedMain) return []
    return state.subscriptions
      .filter((sub) => sub.id !== selectedMain.id)
      .filter((sub) => sub.jointChildren.length === 0)
      .filter(
        (sub) => sub.jointParentId === null || sub.jointParentId === selectedMain.id,
      )
      .sort((a, b) => a.serviceName.localeCompare(b.serviceName, 'zh-CN'))
  }, [state.subscriptions, selectedMain])

  const chooseMain = (nextId: number) => {
    const next = state.subscriptions.find((sub) => sub.id === nextId)
    setMainId(nextId)
    setChildIds(next ? next.jointChildren.map((child) => child.id) : [])
    setCostMode(next?.jointCostMode ?? 'split')
    setReallocate(false)
    setError('')
  }

  const changeMode = (mode: JointCostMode) => {
    if (mode === costMode) return
    setCostMode(mode)
    setReallocate(true)
  }

  const toggleChild = (id: number) => {
    setChildIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedMain) {
      setError('请选择主会员')
      return
    }

    setBusy(true)
    try {
      const next = await api<AppState>(`/subscriptions/${selectedMain.id}/joint`, {
        method: 'PUT',
        body: JSON.stringify({ childIds, costMode, reallocate }),
      })
      onSaved(
        next,
        childIds.length > 0 ? '联合会员已保存' : '已解除联合关系',
      )
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={main ? '编辑联合会员' : '添加联合会员'}
      subtitle={
        main
          ? `${main.serviceName} · 管理附带会员和费用归属`
          : '选择一个主会员，再把一起购买的会员加进来'
      }
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {!main ? (
          <div className="field">
            <label>主会员</label>
            <select
              value={mainId ?? ''}
              onChange={(event) => chooseMain(Number(event.target.value))}
            >
              <option value="">选择主会员</option>
              {mainCandidates.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.serviceName} · {sub.planName}
                </option>
              ))}
            </select>
            <p className="joint-hint">
              没有合适的主会员？先在会员页添加，再回来建立联合关系。
            </p>
          </div>
        ) : null}

        {selectedMain ? (
          <>
            <div className="joint-main-summary">
              <strong>{selectedMain.serviceName}</strong>
              <span>
                {selectedMain.planName} · 月均{' '}
                {selectedMain.cycleMonths === 0
                  ? '一次性'
                  : formatCNY(Math.round(selectedMain.annualized / 12))}
              </span>
            </div>

            <div className="field">
              <label>费用归属</label>
              <div className="joint-modes">
                <label className={`joint-mode ${costMode === 'split' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="joint-cost-mode"
                    checked={costMode === 'split'}
                    onChange={() => changeMode('split')}
                  />
                  <div>
                    <strong>均分</strong>
                    <span>总价按参与会员个数平分，余数给主会员</span>
                  </div>
                </label>
                <label className={`joint-mode ${costMode === 'main' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="joint-cost-mode"
                    checked={costMode === 'main'}
                    onChange={() => changeMode('main')}
                  />
                  <div>
                    <strong>主会员承担</strong>
                    <span>主会员记全额，附带会员记 ¥0</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="field">
              <label>附带会员</label>
              {candidates.length === 0 ? (
                <p className="joint-hint">
                  没有可选的会员。先在会员页添加需要一起管理的会员。
                </p>
              ) : (
                <div className="joint-members">
                  {candidates.map((sub) => (
                    <label
                      key={sub.id}
                      className={`joint-member ${
                        childIds.includes(sub.id) ? 'active' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={childIds.includes(sub.id)}
                        onChange={() => toggleChild(sub.id)}
                      />
                      <div className="joint-member-main">
                        <strong>{sub.serviceName}</strong>
                        <span>
                          {sub.planName} ·{' '}
                          {sub.nextRenewalAt
                            ? formatDate(sub.nextRenewalAt)
                            : '未设置到期日'}
                          {sub.status !== 'active' ? ' · 已过期' : ''}
                        </span>
                      </div>
                      <span className="joint-member-cost">
                        {sub.cycleMonths === 0
                          ? '一次性'
                          : `${formatCNY(Math.round(sub.annualized / 12))}/月`}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <label className="joint-reallocate">
              <input
                type="checkbox"
                checked={reallocate}
                onChange={(event) => setReallocate(event.target.checked)}
              />
              <div>
                <strong>同时重新分摊最近一次购买</strong>
                <span>只改最近一笔支付；不勾选则只影响以后的续费。</span>
              </div>
            </label>

            <div className="joint-summary">
              已选 {childIds.length + 1} 个会员（含主会员）
              {childIds.length === 0
                ? ' · 保存后会解除现有的联合关系，支付记录不变'
                : costMode === 'split'
                  ? ' · 以后的续费按人数均分'
                  : ' · 以后的续费全部记在主会员'}
            </div>
          </>
        ) : (
          <p className="joint-hint">先选择主会员，再设置附带会员和费用归属。</p>
        )}

        {error ? <div className="form-error">{error}</div> : null}

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button
            type="submit"
            className="btn primary"
            disabled={busy || !selectedMain}
          >
            {busy ? '保存中…' : '保存'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
