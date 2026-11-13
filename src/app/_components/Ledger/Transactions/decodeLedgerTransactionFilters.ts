import { QueryParams } from '@/lib/queryParams/queryParams'
import type { SearchParams } from '@/app/ServerPage'
import type { LedgerTransactionFilters } from '@/services/ledger/transactions/types'

/** The filters LedgerTransactionFilter writes to a page's query, read back for the list. */
export function decodeLedgerTransactionFilters(searchParams: SearchParams): LedgerTransactionFilters {
    return {
        search: QueryParams.search.decode(searchParams) ?? undefined,
        purpose: QueryParams.transactionPurpose.decode(searchParams) ?? undefined,
        direction: QueryParams.transactionDirection.decode(searchParams) ?? undefined,
        minAmount: QueryParams.minAmount.decode(searchParams) ?? undefined,
        maxAmount: QueryParams.maxAmount.decode(searchParams) ?? undefined,
    }
}
