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
      return <SubscriptionForm state={state} onClose={onClose} onSaved={onSaved} />
    case 'edit':
      return (
        <SubscriptionForm
          state={state}
          editing={modal.subscription}
          onClose={onClose}
          onSaved={onSaved}
        />
      )
    case 'renew':
      return (
        <PaymentForm
          state={state}
          subscription={modal.subscription}
          onClose={onClose}
          onSaved={onSaved}
        />
      )
    case 'jointRenew':
      return <JointRenewForm state={state} onClose={onClose} onSaved={onSaved} />
    case 'payment':
      return <PaymentForm state={state} onClose={onClose} onSaved={onSaved} />
    case 'snapshot':
      return (
        <SnapshotForm
          plan={modal.plan}
          today={state.today}
          onClose={onClose}
          onSaved={onSaved}
        />
      )
    case 'plan':
      return <PlanForm state={state} onClose={onClose} onSaved={onSaved} />
    case 'jointQuote':
      return <JointQuoteForm state={state} onClose={onClose} onSaved={onSaved} />
  }
}
