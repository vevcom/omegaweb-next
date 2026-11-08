import LedgerTransactionRow from '@/components/Ledger/Transactions/LedgerTransactionRow'
import LedgerTransactionTable, { emptyTransactionsText } from '@/components/Ledger/Transactions/LedgerTransactionTable'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { withPageSession } from '@/app/ServerPage'
import SiteLink from '@/components/SiteLink/SiteLink'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import type { AppHref } from '@/lib/sites/href'

type Props = {
    accountId: number,
    transactionsHref?: AppHref,
}

export default async function LedgerAccountTransactionSummary({ accountId, transactionsHref }: Props) {
    const transactions = await withPageSession(() => ledgerTransactionOperations.readPage({
        params: { paging: { page: { page: 0, pageSize: 5, cursor: null }, details: { accountId } } },
    }))

    return <div className="bg-base-100 rounded-round p-(--card-padding)">
        <h2 className="text-base-content">Transaksjoner</h2>
        {
            transactions.length > 0 ? (
                <div className="overflow-x-auto">
                    <LedgerTransactionTable>
                        {transactions.map(transaction => (
                            <LedgerTransactionRow key={transaction.id} accountId={accountId} transaction={transaction} />
                        ))}
                    </LedgerTransactionTable>
                </div>
            ) : <p className="text-base-content">{emptyTransactionsText}</p>
        }
        {
            transactionsHref &&
            <SiteLink href={transactionsHref} className="btn-primary inline-flex items-center gap-2">
                Se alle transaksjoner <FontAwesomeIcon icon={faArrowRight} />
            </SiteLink>
        }
    </div>
}
