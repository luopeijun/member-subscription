import type { AppState, Plan, SavedHandler, Subscription } from '@/types'
import { JointQuoteForm } from '@/components/JointQuoteForm/JointQuoteForm'
import { JointRenewForm } from '@/components/JointRenewForm/JointRenewForm'
import { PaymentForm } from '@/components/PaymentForm/PaymentForm'
import { QuoteForm } from '@/components/QuoteForm/QuoteForm'
import { SubscriptionForm } from '@/components/SubscriptionForm/SubscriptionForm'

export type ModalState =
  | { kind: 'add' }
  | { kind: 'edit'; subscription: Subscription }
  | { kind: 'renew'; subscription: Subscription }
  | { kind: 'jointRenew' }
  | { kind: 'payment' }
  | { kind: 'quote'; plan: Plan }
  | { kind: 'newQuote' }
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
    case 'quote':
      return (
        <QuoteForm
          key={`quote-${modal.plan.id}`}
          state={state}
          plan={modal.plan}
          onClose={onClose}
          onSaved={onSaved}
        />
      )
    case 'newQuote':
      return (
        <QuoteForm key="new-quote" state={state} onClose={onClose} onSaved={onSaved} />
      )
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
