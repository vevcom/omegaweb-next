'use client'

import styles from './LedgerTransactionList.module.scss'
import LedgerTransactionRow from './LedgerTransactionRow'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import { LedgerTransactionPagingProvider, LedgerTransactionPagingContext } from '@/contexts/paging/LedgerTransactionPaging'
import { useContext } from 'react'

type Props = {
    accountId: number,
}

function EmptyState() {
    const context = useContext(LedgerTransactionPagingContext)
    if (!context) throw new Error('Ingen kontekst')

    if (!context.state.allLoaded || context.state.data.length > 0) return null

    return <p>Her var det tomt! Hva med å ta seg en tur innom Kiogeskapet?</p>
}

export default function TransactionList({ accountId }: Props) {
    return <LedgerTransactionPagingProvider
        startPage={{ page: 0, pageSize: 10 }}
        details={{ accountId }} serverRenderedData={[]}
    >
        <EmptyState />
        <EndlessScroll
            pagingContext={LedgerTransactionPagingContext}
            renderer={
                transaction => <LedgerTransactionRow
                    key={transaction.id}
                    accountId={accountId}
                    transaction={transaction}
                />
            }
            wrapper={children =>
                <table className={styles.transactionList}>
                    <thead>
                        <tr>
                            <th>Dato</th>
                            <th>Beskrivelse</th>
                            <th>Status</th>
                            <th>Beløp</th>
                            <th>Saldoendring</th>
                        </tr>
                    </thead>
                    <tbody>
                        {children}
                    </tbody>
                </table>
            }
        />
    </LedgerTransactionPagingProvider>
}
