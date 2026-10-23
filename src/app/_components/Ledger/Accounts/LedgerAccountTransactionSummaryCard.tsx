import LedgerTransactionRow from '@/components/Ledger/Transactions/LedgerTransactionRow'
import LedgerTransactionTable, { emptyTransactionsText } from '@/components/Ledger/Transactions/LedgerTransactionTable'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { withPageSession } from '@/app/ServerPage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'

type Props = {
    accountId: number,
    transactionsHref?: string,
}

export default async function LedgerAccountTransactionSummary({ accountId, transactionsHref }: Props) {
    const transactions = await withPageSession(() => ledgerTransactionOperations.readPage({
        params: { paging: { page: { page: 0, pageSize: 5, cursor: null }, details: { accountId } } },
    }))

    return <div className="bg-surface-base rounded-round p-(--card-padding)">
        <h2>Transaksjoner</h2>
        {
            transactions.length > 0 ? (
                <div className="overflow-x-auto">
                    <LedgerTransactionTable>
                        {transactions.map(transaction => (
                            <LedgerTransactionRow key={transaction.id} accountId={accountId} transaction={transaction} />
                        ))}
                    </LedgerTransactionTable>
                </div>
            ) : <p>{emptyTransactionsText}</p>
        }
        {
            transactionsHref &&
            <Link href={transactionsHref} className="inline-flex items-center gap-2">
                Se alle transaksjoner <FontAwesomeIcon icon={faArrowRight} />
            </Link>
        }
    </div>
}
