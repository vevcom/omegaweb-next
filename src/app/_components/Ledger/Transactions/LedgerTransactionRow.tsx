import styles from './LedgerTransactionRow.module.scss'
import LedgerTransactionDetails, { transactionPurposeNames, transactionStateNames } from './LedgerTransactionDetails'
import PopUp from '@/components/PopUp/PopUp'
import { displayAmount } from '@/lib/currency/convert'
import type { ExpandedLedgerTransaction } from '@/services/ledger/transactions/types'

type Props = {
    transaction: ExpandedLedgerTransaction,
    accountId: number,
}

// Incomplete (PENDING) transactions are shown in italic; terminal-but-unsuccessful (FAILED,
// CANCELED) transactions are struck through. SUCCEEDED is the plain/default style. The detailed
// popup still spells the state out in full.
function stateStyle(state: ExpandedLedgerTransaction['state']) {
    if (state === 'PENDING') return styles.pending
    if (state === 'FAILED' || state === 'CANCELED') return styles.terminalFailure
    return undefined
}

export default function LedgerTransactionRow({ transaction, accountId }: Props) {
    const totalFunds = (
        transaction.ledgerEntries?.reduce((sum, entry) => sum + Math.abs(entry.funds), 0)
        + Math.abs(transaction.payment?.funds ?? 0)
    ) / 2

    const fundsChange = transaction.ledgerEntries.find(entry => entry.ledgerAccountId === accountId)?.funds ?? null

    const rowClassName = [styles.row, stateStyle(transaction.state)].filter(Boolean).join(' ')

    return <PopUp
        popUpKey={`LedgerTransactionDetails${transaction.id}`}
        customShowButton={open => (
            <tr className={rowClassName} onClick={open}>
                <td>{transaction.createdAt.toLocaleString()}</td>
                <td>{transaction.description ?? transactionPurposeNames[transaction.purpose]}</td>
                <td>{transactionStateNames[transaction.state]}</td>
                <td className={styles.rightAlign}><b>{displayAmount(totalFunds)}</b></td>
                <td className={styles.rightAlign}>
                    <b>{fundsChange !== null ? displayAmount(fundsChange, true, true) : '-'}</b>
                </td>
            </tr>
        )}
    >
        <LedgerTransactionDetails transaction={transaction} accountId={accountId} />
    </PopUp>
}
