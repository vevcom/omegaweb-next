import { determineTransactionState } from '@/services/ledger/transactions/determineTransactionState'
import { describe, expect, test } from '@jest/globals'
import type { ExpandedLedgerTransaction } from '@/services/ledger/transactions/types'
import type { BalanceRecord } from '@/services/ledger/accounts/types'
import type { LedgerTransactionState, PaymentState } from '@/prisma-generated-pn-types'

const BUYER = 1
const SELLER = 2

type Entry = { ledgerAccountId: number, funds: number, fees: number | null }
type PaymentFields = { state: PaymentState, funds: number, fees: number | null }

/** Only the fields the rules read are filled in. */
function transactionOf({ state = 'PENDING', entries, payment = null }: {
    state?: LedgerTransactionState,
    entries: Entry[],
    payment?: PaymentFields | null,
}) {
    return { state, ledgerEntries: entries, payment } as unknown as ExpandedLedgerTransaction
}

/** Balances as `advance` reads them: at the transaction, with its own debits already reserved. */
const balancesAfter = (buyerAmount: number): BalanceRecord => ({
    [BUYER]: { amount: buyerAmount, fees: 0 },
    [SELLER]: { amount: 0, fees: 0 },
})

const stateOf = async (transaction: ExpandedLedgerTransaction, balances: BalanceRecord = balancesAfter(0)) =>
    determineTransactionState({ transaction, balances, frozenAccountIds: new Set() })

const transfer = (funds: number, fees: number | null = 0): Entry[] => [
    { ledgerAccountId: SELLER, funds, fees },
    { ledgerAccountId: BUYER, funds: -funds, fees: fees === null ? null : -fees },
]

describe('determineTransactionState', () => {
    test('a balanced transfer the buyer can afford succeeds', async () => {
        expect(await stateOf(transactionOf({ entries: transfer(50_00) }), balancesAfter(50_00)))
            .toEqual({ state: 'SUCCEEDED' })
    })

    test('a transfer that leaves the buyer below zero fails', async () => {
        const transition = await stateOf(transactionOf({ entries: transfer(50_00) }), balancesAfter(-1))

        expect(transition.state).toBe('FAILED')
    })

    test('entries that do not sum to zero fail', async () => {
        const entries = [
            { ledgerAccountId: SELLER, funds: 50_00, fees: 0 },
            { ledgerAccountId: BUYER, funds: -49_99, fees: 0 },
        ]

        expect((await stateOf(transactionOf({ entries }), balancesAfter(50_00))).state).toBe('FAILED')
    })

    test('a deposit must credit exactly what the payment brings in', async () => {
        const deposit = (credited: number) => transactionOf({
            entries: [{ ledgerAccountId: BUYER, funds: credited, fees: 0 }],
            payment: { state: 'SUCCEEDED', funds: 100_00, fees: 0 },
        })

        expect((await stateOf(deposit(100_00))).state).toBe('SUCCEEDED')
        expect((await stateOf(deposit(100_01))).state).toBe('FAILED')
    })

    test('an entry whose fees have the opposite sign of its funds fails', async () => {
        const entries = [
            { ledgerAccountId: SELLER, funds: 50_00, fees: -1_00 },
            { ledgerAccountId: BUYER, funds: -50_00, fees: 1_00 },
        ]

        expect((await stateOf(transactionOf({ entries }), balancesAfter(50_00))).state).toBe('FAILED')
    })

    test('fees that do not sum to the fees of the payment fail', async () => {
        const transaction = transactionOf({
            entries: [{ ledgerAccountId: BUYER, funds: 100_00, fees: 1_00 }],
            payment: { state: 'SUCCEEDED', funds: 100_00, fees: 2_00 },
        })

        expect((await stateOf(transaction)).state).toBe('FAILED')
    })

    test('stays pending while the payment is under way', async () => {
        const underWay = (state: PaymentState) => transactionOf({
            entries: [{ ledgerAccountId: BUYER, funds: 100_00, fees: null }],
            payment: { state, funds: 100_00, fees: null },
        })

        expect(await stateOf(underWay('PENDING'))).toEqual({ state: 'PENDING' })
        expect(await stateOf(underWay('PROCESSING'))).toEqual({ state: 'PENDING' })
    })

    test('fails when the payment fails or is canceled', async () => {
        const ended = (state: PaymentState) => transactionOf({
            entries: [{ ledgerAccountId: BUYER, funds: 100_00, fees: null }],
            payment: { state, funds: 100_00, fees: null },
        })

        expect((await stateOf(ended('FAILED'))).state).toBe('FAILED')
        expect((await stateOf(ended('CANCELED'))).state).toBe('FAILED')
    })

    test('a completed payment must have its fees settled before the transaction succeeds', async () => {
        const transaction = transactionOf({
            entries: [{ ledgerAccountId: BUYER, funds: 100_00, fees: null }],
            payment: { state: 'SUCCEEDED', funds: 100_00, fees: 1_00 },
        })

        expect((await stateOf(transaction)).state).toBe('FAILED')
    })

    test('a transaction that has already ended keeps its state', async () => {
        const endedStates: LedgerTransactionState[] = ['SUCCEEDED', 'FAILED', 'CANCELED']

        await Promise.all(endedStates.map(async state => {
            // Entries that would fail every other rule, to show none of them are reached.
            const transaction = transactionOf({ state, entries: [{ ledgerAccountId: BUYER, funds: -1, fees: 1 }] })

            expect((await stateOf(transaction, balancesAfter(-1))).state).toBe(state)
        }))
    })
})
