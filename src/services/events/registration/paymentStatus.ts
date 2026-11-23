import type { EventRegistrationOfUser } from './types'

export type PaymentStatus = 'NOT_REGISTERED' | 'WAITING_LIST' | 'PAID' | 'UNPAID'

/** Where the visitor stands with paying for the variant. Only a registration holding a place is paid for. */
export function paymentStatus(registration: EventRegistrationOfUser | null): PaymentStatus {
    if (!registration) return 'NOT_REGISTERED'
    if (registration.state === 'WAITING_LIST') return 'WAITING_LIST'
    if (registration.ledgerTransactions.length > 0 || registration.manuallyPaid) return 'PAID'
    return 'UNPAID'
}
