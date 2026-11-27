import LedgerAccountCard from './LedgerAccountCard'
import LedgerTransactionRow from '@/components/Ledger/Transactions/LedgerTransactionRow'
import LedgerTransactionTable, { emptyTransactionsText } from '@/components/Ledger/Transactions/LedgerTransactionTable'
import SiteLink from '@/components/SiteLink/SiteLink'
import { componentWithSkeleton } from '@/app/componentWithSkeleton'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import type { AppHref } from '@/lib/sites/href'
import type { ExpandedLedgerTransaction } from '@/services/ledger/transactions/types'

/** How many of an account's latest transactions the card shows, which is what its page reads. */
export const transactionSummarySize = 5

type Known = {
    accountId: number,
    transactionsHref?: AppHref,
}

type Read = {
    transactions: ExpandedLedgerTransaction[],
}

/** While it loads, the card is as it is for an account with a full summary of transactions. */
export const LedgerAccountTransactionSummary = componentWithSkeleton<Known, Read>(
    ({ accountId, transactionsHref, loaded, Skeleton, transactions }) => (
        <LedgerAccountCard title="Transaksjoner">
            {loaded && transactions.length === 0 ? <p className="text-base-content">{emptyTransactionsText}</p> : (
                <div className="overflow-x-auto">
                    <LedgerTransactionTable>
                        {loaded ? transactions.map(transaction => (
                            <LedgerTransactionRow key={transaction.id} accountId={accountId} transaction={transaction} />
                        )) : Array.from({ length: transactionSummarySize }, (_, row) => (
                            <tr key={row}>
                                <td colSpan={5}><Skeleton className="h-lh w-full" /></td>
                            </tr>
                        ))}
                    </LedgerTransactionTable>
                </div>
            )}
            {transactionsHref && (
                <SiteLink href={transactionsHref} className="btn-primary inline-flex items-center gap-2">
                    Se alle transaksjoner <FontAwesomeIcon icon={faArrowRight} />
                </SiteLink>
            )}
        </LedgerAccountCard>
    )
)
