import { ledgerTransactionDirections } from './constants'
import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { searchMaxLength } from '@/services/search/constants'
import { LedgerTransactionPurpose } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const paramsFieldSchemas = z.object({
    id: z.number(),
    accountId: z.number(),
    purpose: z.nativeEnum(LedgerTransactionPurpose),
    ledgerEntries: z.object({
        funds: z.number(),
        fees: z.number().optional(),
        ledgerAccountId: z.number(),
    }).array(),
    paymentId: z.number().optional(),
    description: z.string().optional(),
    // Traceability back to what the transaction paid for. At most one is ever set,
    // depending on `purpose`.
    eventRegistrationId: z.number().optional(),
    bookingId: z.number().optional(),
    purchaseId: z.number().optional(),
    search: z.string().trim().max(searchMaxLength),
    direction: z.enum(ledgerTransactionDirections),
    // In øre. They bound the size of the account's balance change, whichever way it goes.
    minAmount: z.number().int().min(0),
    maxAmount: z.number().int().min(0),
})

const transaction = paramsFieldSchemas.pick({
    id: true,
})

export const ledgerTransactionSchemas = {
    params: {
        read: transaction,
        readStateByPayment: paramsFieldSchemas.pick({ paymentId: true }).required(),
        cancel: transaction,
        initiate: transaction,
        readPage: readPageInputSchemaObject(
            paramsFieldSchemas.pick({
                id: true,
            }),
            paramsFieldSchemas.pick({
                accountId: true,
            }).merge(paramsFieldSchemas.pick({
                purpose: true,
                search: true,
                direction: true,
                minAmount: true,
                maxAmount: true,
            }).partial()),
        ),
        advance: transaction,
        create: paramsFieldSchemas.pick({
            purpose: true,
            ledgerEntries: true,
            paymentId: true,
            description: true,
            eventRegistrationId: true,
            bookingId: true,
            purchaseId: true,
        }),
    },
}
