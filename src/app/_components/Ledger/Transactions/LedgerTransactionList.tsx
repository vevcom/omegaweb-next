'use client'

import LedgerTransactionRow from './LedgerTransactionRow'
import LedgerTransactionFilter from './LedgerTransactionFilter'
import LedgerTransactionTable, { emptyTransactionsText } from './LedgerTransactionTable'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import { LedgerTransactionPagingProvider, LedgerTransactionPagingContext } from '@/contexts/paging/LedgerTransactionPaging'
import { useContext, useMemo } from 'react'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'
import type { LedgerTransactionFilters } from '@/services/ledger/transactions/types'

type Props = {
    accountId: number,
    filters: LedgerTransactionFilters,
    capabilities: CapabilitiesJsObject<'canCancel'>,
}

function EmptyState({ filtered }: { filtered: boolean }) {
    const context = useContext(LedgerTransactionPagingContext)
    if (!context) throw new Error('Ingen kontekst')

    if (!context.state.allLoaded || context.state.data.length > 0) return null

    return <p>{filtered ? 'Ingen transaksjoner passer filtrene.' : emptyTransactionsText}</p>
}

export default function TransactionList({ accountId, filters, capabilities }: Props) {
    const { search, purpose, direction, minAmount, maxAmount } = filters
    // Memoized, since the provider starts the list over whenever its details change.
    const details = useMemo(
        () => ({ accountId, search, purpose, direction, minAmount, maxAmount }),
        [accountId, search, purpose, direction, minAmount, maxAmount],
    )
    const filtered = Object.values(filters).some(value => value !== undefined)

    return <LedgerTransactionPagingProvider
        startPage={{ page: 0, pageSize: 10 }}
        details={details} serverRenderedData={[]}
    >
        <LedgerTransactionFilter filters={filters} />
        <EmptyState filtered={filtered} />
        <EndlessScroll
            pagingContext={LedgerTransactionPagingContext}
            renderer={
                transaction => <LedgerTransactionRow
                    key={transaction.id}
                    accountId={accountId}
                    transaction={transaction}
                    capabilities={capabilities}
                />
            }
            wrapper={children => <LedgerTransactionTable>{children}</LedgerTransactionTable>}
        />
    </LedgerTransactionPagingProvider>
}
