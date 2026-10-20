import type { expandedLedgerTransactionIncluder } from './constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export type ExpandedLedgerTransaction = Prisma.LedgerTransactionGetPayload<{
    include: typeof expandedLedgerTransactionIncluder,
}>
