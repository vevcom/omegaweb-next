'use client'

import LedgerTransactionRow from './LedgerTransactionRow'
import LedgerTransactionTable, { emptyTransactionsText } from './LedgerTransactionTable'
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

    return <p>{emptyTransactionsText}</p>
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
            wrapper={children => <LedgerTransactionTable>{children}</LedgerTransactionTable>}
        />
    </LedgerTransactionPagingProvider>
}
