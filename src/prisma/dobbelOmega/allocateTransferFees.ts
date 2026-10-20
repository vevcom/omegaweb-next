import { feesFormula } from '@/services/ledger/transactions/calculateFees'

export type OwDrainPayment = {
    id: number
    drainAccountId: number
    price: number
    repaidFees: number
    createdAt: Date
}

export type OwDrainTransfer = {
    id: number
    drainAccountId: number | null
    amount: number
    createdAt: Date
}

type DrainEvent =
    | { kind: 'payment', payment: OwDrainPayment }
    | { kind: 'transfer', transfer: OwDrainTransfer }

const eventTime = (event: DrainEvent) =>
    (event.kind === 'payment' ? event.payment.createdAt : event.transfer.createdAt).getTime()
const eventId = (event: DrainEvent) => (event.kind === 'payment' ? event.payment.id : event.transfer.id)
const kindOrder = (event: DrainEvent) => (event.kind === 'payment' ? 0 : 1)

/**
 * OW transfers are net amounts, since OW subtracted repaid fees from a drain account's balance.
 * Native payouts are gross with separate fees, so this replays each drain account in date order
 * and gives every transfer its share of the account's fees at that time.
 *
 * @returns The fees of each transfer, keyed by OW transfer id.
 */
export function allocateTransferFees(payments: OwDrainPayment[], transfers: OwDrainTransfer[]) {
    const eventsByAccount = new Map<number, DrainEvent[]>()
    const addEvent = (drainAccountId: number, event: DrainEvent) => {
        const events = eventsByAccount.get(drainAccountId) ?? []
        events.push(event)
        eventsByAccount.set(drainAccountId, events)
    }
    payments.forEach(payment => addEvent(payment.drainAccountId, { kind: 'payment', payment }))
    transfers.forEach(transfer => {
        if (transfer.drainAccountId !== null) addEvent(transfer.drainAccountId, { kind: 'transfer', transfer })
    })

    const feesByTransferId = new Map<number, number>(transfers.map(transfer => [transfer.id, 0]))

    for (const events of Array.from(eventsByAccount.values())) {
        // Payments go before transfers at the same instant, so a transfer can draw on them.
        events.sort((first, second) =>
            eventTime(first) - eventTime(second)
            || kindOrder(first) - kindOrder(second)
            || eventId(first) - eventId(second)
        )

        let amount = 0
        let fees = 0
        for (const event of events) {
            if (event.kind === 'payment') {
                amount += event.payment.price
                fees += event.payment.repaidFees
                continue
            }
            // feesFormula on net values gives fees * net transfer / net balance, clamped to [0, fees].
            const transferFees = feesFormula(event.transfer.amount, amount - fees, fees)
            amount -= event.transfer.amount + transferFees
            fees -= transferFees
            feesByTransferId.set(event.transfer.id, transferFees)
        }
    }

    return feesByTransferId
}
