import type { ExpandedLedgerTransaction } from './types'
import type { BalanceRecord } from '@/services/ledger/accounts/types'
import type { LedgerTransactionState, PaymentState } from '@/prisma-generated-pn-types'

type LedgerTransactionTransition = {
    state: LedgerTransactionState,
    reason?: string,
}

type LedgerTransactionRuleContext = {
    transaction: ExpandedLedgerTransaction,
    balances: BalanceRecord,
    frozenAccountIds: Set<number>,
}

type LedgerTransactionRule = (context: LedgerTransactionRuleContext) => LedgerTransactionTransition | null

/**
 * Determines the state of a given transaction.
 */
export function determineTransactionState(
    context: LedgerTransactionRuleContext
): LedgerTransactionTransition {
    // NOTE: The order of the rules are important!
    // Fee checks must run only after payment completes
    // since fees aren't set earlier.
    const rules: LedgerTransactionRule[] = [
        noTerminalState,
        noFrozenAccounts,
        noFailedPayment,
        amountAndFeesHaveSameSigns,
        validAmountSum,
        sufficientBalances,
        transfersComplete,
        noNullFees,
        validFeesSum,
    ]

    for (const rule of rules) {
        const state = rule(context)

        if (state) return state
    }

    return { state: 'SUCCEEDED' }
}

/**
 * A transaction in a terminal state (SUCCEEDED, FAILED or CANCELED)
 * can never change state.
 */
function noTerminalState(
    { transaction }: LedgerTransactionRuleContext
): LedgerTransactionTransition | null {
    if (transaction.state !== 'PENDING') return { state: transaction.state }

    return null
}

function noFrozenAccounts(
    { transaction, frozenAccountIds }: LedgerTransactionRuleContext
): LedgerTransactionTransition | null {
    const hasFrozenAccount = transaction.ledgerEntries.some(entry => frozenAccountIds.has(entry.ledgerAccountId))

    if (hasFrozenAccount) return { state: 'FAILED', reason: 'En eller flere kontoer er frossene.' }

    return null
}

/**
 * If any payment has failed, the entire transaction has failed.
 */
function noFailedPayment(
    { transaction }: LedgerTransactionRuleContext
): LedgerTransactionTransition | null {
    const okStates: PaymentState[] = ['PENDING', 'PROCESSING', 'SUCCEEDED']
    const hasFailedPayment = transaction.payment && !okStates.includes(transaction.payment.state)

    if (hasFailedPayment) return { state: 'FAILED', reason: 'Betaling mislyktes.' }

    return null
}

/**
 * Check that ledger entries, payment and manual transfer have correct signs.
 *
 * Mathematically: `amount >= 0 <=> fees >= 0` and `amount <= 0 <=> fees <= 0`.
 */
function amountAndFeesHaveSameSigns(
    { transaction }: LedgerTransactionRuleContext
): LedgerTransactionTransition | null {
    // Helper function which return true when a and b have same signs or at least
    // one of a and b are falsy.
    const sameSigns = (a?: number | null, b?: number | null) => !a || !b || Math.sign(a) === Math.sign(b)

    const validEntries = transaction.ledgerEntries.every(entry => sameSigns(entry.funds, entry.fees))
    const validTransfer = !transaction.payment || sameSigns(transaction.payment.funds, transaction.payment.fees)

    if (!validEntries || !validTransfer) return { state: 'FAILED', reason: 'Ugyldige beløp og/eller gebyrer.' }

    return null
}

/**
 * Kirchhoff's first law! The sum of all amounts must be zero.
 * I.e. money must come from somewhere and go to somewhere.
 */
function validAmountSum(
    { transaction }: LedgerTransactionRuleContext
): LedgerTransactionTransition | null {
    // NOTE: Since the number of entries in a transaction is very low (max two) we can
    // sum the amounts and fees in memory rather than doing a database aggregation.
    const totalLedgerEntryFunds = transaction.ledgerEntries.reduce((sum, entry) => sum + entry.funds, 0)
    const paymentFunds = transaction.payment?.funds ?? 0

    if (totalLedgerEntryFunds !== paymentFunds) return { state: 'FAILED', reason: 'Ugyldig totalbeløp.' }

    return null
}

/**
 * If an entry is debit (amount < 0), its referenced account must
 * have a positive balance after the transaction succeeds.
 */
function sufficientBalances(
    { transaction, balances }: LedgerTransactionRuleContext,
): LedgerTransactionTransition | null {
    const debitLedgerAccountIds = transaction.ledgerEntries
        .filter(entry => entry.funds < 0)
        .map(entry => entry.ledgerAccountId)
    const debitBalances = debitLedgerAccountIds.map(id => balances[id])

    if (debitBalances.some(balance => !balance)) {
        throw new Error('Missing balance in balance record.')
    }

    const hasNegativeBalance = debitBalances.some(balance => balance.amount < 0 || balance.fees < 0)

    if (hasNegativeBalance) return { state: 'FAILED', reason: 'Ikke nok midler for å utføre transaksjonen.' }

    return null
}

/**
 * If any payment is pending, the transaction is pending.
 */
function transfersComplete(
    { transaction }: LedgerTransactionRuleContext
): LedgerTransactionTransition | null {
    // Since we have checked for failure states above,
    // we can simply check that the transfer has not succeeded.
    const hasPendingTransfer = transaction.payment && transaction.payment.state !== 'SUCCEEDED'

    if (hasPendingTransfer) return { state: 'PENDING' }

    return null
}

/**
 * All fees must be non-null.
 */
function noNullFees(
    { transaction }: LedgerTransactionRuleContext
): LedgerTransactionTransition | null {
    const hasNullFees =
        transaction.ledgerEntries.some(entry => entry.fees === null) ||
        transaction.payment?.fees === null

    if (hasNullFees) return { state: 'FAILED', reason: 'Manglende gebyrer.' }

    return null
}

/**
 * Fees must also follow Kirchhoff's first law.
 */
function validFeesSum(
    { transaction }: LedgerTransactionRuleContext
): LedgerTransactionTransition | null {
    // NOTE: Since the number of entries in a transaction is very low (max two) we can
    // sum the amounts and fees in memory rather than doing a database aggregation.
    const totalLedgerEntryFees = transaction.ledgerEntries.reduce((sum, entry) => sum + entry.fees!, 0)
    const paymentFees = transaction.payment?.fees ?? 0

    if (totalLedgerEntryFees !== paymentFees) return { state: 'FAILED', reason: 'Ugyldig sum av gebyrer.' }

    return null
}
