import { readPageInputSchemaObject } from '@/lib/paging/schema'
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
    reviewId: z.number(),
})

const dataFieldSchemas = z.object({
    resolutionDescription: z.string().trim().min(1),
})

const transaction = paramsFieldSchemas.pick({
    id: true,
})

export const ledgerTransactionSchemas = {
    params: {
        read: transaction,
        cancel: transaction,
        initiate: transaction,
        readPage: readPageInputSchemaObject(
            paramsFieldSchemas.pick({
                id: true,
            }),
            paramsFieldSchemas.pick({
                accountId: true,
            }),
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
        resolveManualReview: paramsFieldSchemas.pick({
            reviewId: true,
        }),
    },
    data: {
        resolveManualReview: dataFieldSchemas.pick({
            resolutionDescription: true,
        }),
    },
}
