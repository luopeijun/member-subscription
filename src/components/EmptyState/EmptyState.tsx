import type { ReactNode } from 'react'
import './EmptyState.scss'

type EmptyStateProps = {
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="empty-dot" />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}
