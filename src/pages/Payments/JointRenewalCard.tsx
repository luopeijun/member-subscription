import type { JointRenewal } from '@/types'
import { formatCNY } from '@shared/money'
import { formatDuration } from '@shared/duration'
import { formatDate } from '@/utils/format'
import './JointRenewalCard.scss'

type JointRenewalCardProps = {
  renewal: JointRenewal
  onDelete: (jointRenewal: JointRenewal) => void
}

export function JointRenewalCard({ renewal, onDelete }: JointRenewalCardProps) {
  return (
    <article className="card joint-renewal-card">
      <div className="joint-renewal-head">
        <div>
          <strong>
            {formatDate(renewal.paidAt)} · {renewal.members.length} 个会员
          </strong>
          <span>合计 {formatCNY(renewal.total)}</span>
        </div>
        <span className="badge joint">
          {renewal.costMode === 'split' ? '均分' : '主会员承担'}
        </span>
      </div>
      <div className="joint-renewal-members">
        {renewal.members.map((member) => (
          <span className="joint-renewal-member" key={member.subscriptionId}>
            {member.serviceName}
            <em>
              {formatDuration(member.durationDays)} · {formatCNY(member.amount)}
            </em>
          </span>
        ))}
      </div>
      <div className="joint-renewal-foot">
        <span>
          费用归属：{renewal.mainServiceName ?? '已删除会员'} ·{' '}
          {renewal.costMode === 'split' ? '均分' : '主会员承担'}
          {renewal.note ? ` · ${renewal.note}` : ''}
        </span>
        <button className="btn sm danger" onClick={() => onDelete(renewal)}>
          删除记录
        </button>
      </div>
    </article>
  )
}
