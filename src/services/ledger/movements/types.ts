import type { SessionMaybeUser } from '@/auth/session/Session'
import type { Awaitable } from '@/lib/awaitable'
import type { ExpandedPayment } from '@/services/ledger/payments/types'
import type { ExpandedLedgerTransaction } from '@/services/ledger/transactions/types'
import type { LedgerTransactionPurpose, Prisma } from '@/prisma-generated-pn-types'

/** What a payment through `createPayment` charges, as the implementing service reads it. */
export type PaymentCharge = {
    funds: number,
    destinationLedgerAccountId: number,
    // Whose balance `amountFromBalance` comes from, or null when there is none, such as for a guest.
    payerUserId: number | null,
    descriptionLong: string,
    // What the transaction pays for, which earlier attempts are found by. Null for a payment that
    // may be made any number of times, such as a deposit.
    link: { eventRegistrationId: number } | { bookingId: number } | null,
    // Whether a PENDING attempt on the same link is canceled and replaced, rather than refused.
    replacesPendingAttempt: boolean,
}

export type CreatePaymentImplementationFields = {
    purpose: LedgerTransactionPurpose,
    descriptionShort: string,
    // Runs first in the payment's database transaction. It locks the implementer's row, checks that
    // it may be paid for now and says what is charged.
    prepare: (tx: Prisma.TransactionClient, context: { session: SessionMaybeUser }) => Awaitable<PaymentCharge>,
}

/** The transaction a payment created, and its payment with the live client secret, if it has one. */
export type CreatedPayment = {
    transaction: ExpandedLedgerTransaction,
    payment: ExpandedPayment | null,
}
