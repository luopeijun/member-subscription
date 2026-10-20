import type { AppState, Plan, SavedHandler, Subscription } from '@/types'
import { JointQuoteForm } from '@/components/JointQuoteForm/JointQuoteForm'
import { JointRenewForm } from '@/components/JointRenewForm/JointRenewForm'
import { PaymentForm } from '@/components/PaymentForm/PaymentForm'
import { PlanForm } from '@/components/PlanForm/PlanForm'
import { SnapshotForm } from '@/components/SnapshotForm/SnapshotForm'
import { SubscriptionForm } from '@/components/SubscriptionForm/SubscriptionForm'

export type ModalState =
  | { kind: 'add' }
  | { kind: 'edit'; subscription: Subscription }
  | { kind: 'renew'; subscription: Subscription }
  | { kind: 'jointRenew' }
  | { kind: 'payment' }
  | { kind: 'snapshot'; plan: Plan }
  | { kind: 'plan' }
  | { kind: 'jointQuote' }

type AppModalsProps = {
  state: AppState
  modal: ModalState | null
  onClose: () => void
  onSaved: SavedHandler
}

export function AppModals({ state, modal, onClose, onSaved }: AppModalsProps) {
  if (!modal) return null

  switch (modal.kind) {
    case 'add':
      return (
        <SubscriptionForm
          key="add"
          state={state}
          onClose={onClose}
          onSaved={onSaved}
        />
      )
    case 'edit':
      return (
        <SubscriptionForm
          key={`edit-${modal.subscription.id}`}
          state={state}
          editing={modal.subscription}
          onClose={onClose}
          onSaved={onSaved}
        />
      )
    case 'renew':
      return (
        <PaymentForm
          key={`renew-${modal.subscription.id}`}
          state={state}
          subscription={modal.subscription}
          onClose={onClose}
          onSaved={onSaved}
        />
      )
    case 'jointRenew':
      return (
        <JointRenewForm
          key="jointRenew"
          state={state}
          onClose={onClose}
          onSaved={onSaved}
        />
      )
    case 'payment':
      return (
        <PaymentForm
          key="payment"
          state={state}
          onClose={onClose}
          onSaved={onSaved}
        />
      )
    case 'snapshot':
      return (
        <SnapshotForm
          key={`snapshot-${modal.plan.id}`}
          plan={modal.plan}
          today={state.today}
          onClose={onClose}
          onSaved={onSaved}
        />
      )
    case 'plan':
      return <PlanForm key="plan" state={state} onClose={onClose} onSaved={onSaved} />
    case 'jointQuote':
      return (
        <JointQuoteForm
          key="jointQuote"
          state={state}
          onClose={onClose}
          onSaved={onSaved}
        />
      )
  }
}
