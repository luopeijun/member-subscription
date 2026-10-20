import type { AppState } from '@/types'
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog'

type ResetDataDialogProps = {
  state: AppState
  open: boolean
  acknowledged: boolean
  busy: boolean
  onAcknowledgedChange: (value: boolean) => void
  onConfirm: () => void
  onClose: () => void
}

export function ResetDataDialog({
  state,
  open,
  acknowledged,
  busy,
  onAcknowledgedChange,
  onConfirm,
  onClose,
}: ResetDataDialogProps) {
  if (!open) return null

  return (
    <ConfirmDialog
      title="清空全部数据"
      subtitle="此操作不可恢复，请谨慎操作"
      confirmLabel="确认清空"
      confirmDisabled={!acknowledged}
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
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
          checked={acknowledged}
          onChange={(event) => onAcknowledgedChange(event.target.checked)}
        />
        <span>我已了解，确认清空全部数据</span>
      </label>
    </ConfirmDialog>
  )
}
