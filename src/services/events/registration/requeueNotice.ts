import type { PaymentStatus } from './paymentStatus'

export type RequeueNotice = 'BEFORE_DEADLINE' | 'AFTER_DEADLINE'

/** Follows when requeueNextUnpaidRegistration may move a registration. */
export function requeueNotice({ requeueUnpaidRegistrations, status, deadline, paymentEnd, eventStart, registeredAt, now }: {
    requeueUnpaidRegistrations: boolean,
    status: PaymentStatus,
    deadline: Date,
    paymentEnd: Date,
    eventStart: Date,
    registeredAt: Date | null,
    now: Date,
}): RequeueNotice | null {
    if (!requeueUnpaidRegistrations || now >= eventStart) return null
    if (status !== 'NOT_REGISTERED' && status !== 'UNPAID') return null

    if (now <= deadline) return deadline < eventStart ? 'BEFORE_DEADLINE' : null

    const leftToAdministrators = registeredAt !== null && registeredAt > paymentEnd && deadline <= paymentEnd
    return status === 'UNPAID' && !leftToAdministrators ? 'AFTER_DEADLINE' : null
}
