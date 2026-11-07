import type { expandedLedgerTransactionIncluder } from './constants'
import type { ledgerTransactionSchemas } from './schemas'
import type { InferPagingDetails } from '@/lib/paging/schema'
import type { Prisma } from '@/prisma-generated-pn-types'

export type ExpandedLedgerTransaction = Prisma.LedgerTransactionGetPayload<{
    include: typeof expandedLedgerTransactionIncluder,
}>

export type LedgerTransactionPageDetails = InferPagingDetails<typeof ledgerTransactionSchemas.params.readPage>

/** What a list of an account's transactions is narrowed by. */
export type LedgerTransactionFilters = Omit<LedgerTransactionPageDetails, 'accountId'>
