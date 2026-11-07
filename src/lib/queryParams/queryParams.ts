import {
    BooleanQueryParam,
    EnumQueryParam,
    LocalPathQueryParam,
    NumberQueryParam,
    StringArrayQueryParam,
    StringQueryParam,
} from './queryParam'
import { ledgerTransactionDirections } from '@/services/ledger/transactions/constants'
import { LedgerTransactionPurpose } from '@/prisma-generated-pn-types'
import type { QueryParam } from './queryParam'
export const QueryParams = {
    eventTags: new StringArrayQueryParam('event-tags'),
    onlyActive: new BooleanQueryParam('only-active'),
    onlyAdministratedCollections: new BooleanQueryParam('only-administrated-collections'),
    userId: new NumberQueryParam('user-id'),
    companyName: new StringQueryParam('company-name'),
    search: new StringQueryParam('search'),
    token: new StringQueryParam('token'),
    callbackUrl: new LocalPathQueryParam('callbackUrl'),
    frontpageVersion: new EnumQueryParam('frontpage-version', ['logged-out', 'logged-in']),
    transactionPurpose: new EnumQueryParam('type', Object.values(LedgerTransactionPurpose)),
    transactionDirection: new EnumQueryParam('direction', [...ledgerTransactionDirections]),
    // In øre.
    minAmount: new NumberQueryParam('min-amount'),
    maxAmount: new NumberQueryParam('max-amount'),
} as const satisfies Record<string, QueryParam<string | string[] | number | number[] | boolean>>

export type QueryParamNames = typeof QueryParams[keyof typeof QueryParams]['name']
