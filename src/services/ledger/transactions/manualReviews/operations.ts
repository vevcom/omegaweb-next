import '@pn-server-only'
import { manualReviewAuth } from './auth'
import { manualReviewSchemas } from './schemas'
import { Smorekopp } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import logger from '@/lib/logger'

export const manualReviewOperations = {
    /**
     * Flags a transaction for a human: logs "MANUAL ADMIN ACTION REQUIRED!" and records a
     * ManualTransactionReview. Never throws, since every caller is a best-effort path.
     */
    create: defineOperation({
        authorizer: () => manualReviewAuth.create,
        paramsSchema: manualReviewSchemas.params.create,
        operation: async ({ prisma, params }) => {
            try {
                logger.error(
                    `MANUAL ADMIN ACTION REQUIRED! ${params.problemDescription} (transaksjon ${params.transactionId})`,
                    params.error && { error: params.error }
                )
                await prisma.manualTransactionReview.create({
                    data: { transactionId: params.transactionId, problemDescription: params.problemDescription },
                })
            } catch (error) {
                logger.error(
                    'MANUAL ADMIN ACTION REQUIRED! Could not record a manual review for transaction '
                    + `${params.transactionId}.`,
                    { error }
                )
            }
        },
    }),

    /**
     * Lists transactions a human needs to look at: any with an OPEN ManualTransactionReview.
     * Admin-only, across every account, not scoped to one the caller is a party to.
     */
    readOpen: defineOperation({
        authorizer: () => manualReviewAuth.readOpen,
        operation: async ({ prisma }) => prisma.ledgerTransaction.findMany({
            where: { manualReviews: { some: { state: 'OPEN' } } },
            select: {
                id: true,
                purpose: true,
                state: true,
                reason: true,
                createdAt: true,
                ledgerEntries: { select: { ledgerAccountId: true, funds: true } },
                manualReviews: { orderBy: { createdAt: 'desc' } },
            },
            orderBy: { createdAt: 'desc' },
        })
    }),

    /** Marks an open manual review resolved, with the admin's own account of how. */
    resolve: defineOperation({
        authorizer: () => manualReviewAuth.resolve,
        paramsSchema: manualReviewSchemas.params.resolve,
        dataSchema: manualReviewSchemas.data.resolve,
        operation: async ({ prisma, params, data }) => {
            // Guarded in the update itself, not a separate read then write - two admins
            // resolving the same review at once would otherwise both pass a plain read and the
            // second would silently overwrite the first's resolutionDescription.
            const { count } = await prisma.manualTransactionReview.updateMany({
                where: { id: params.reviewId, state: 'OPEN' },
                data: { state: 'RESOLVED', resolutionDescription: data.resolutionDescription },
            })
            if (count === 0) {
                // Throws NOT FOUND for a missing id; otherwise it exists but wasn't OPEN.
                await prisma.manualTransactionReview.findUniqueOrThrow({ where: { id: params.reviewId } })
                throw new Smorekopp('BAD PARAMETERS', 'Denne saken er allerede løst.')
            }

            return await prisma.manualTransactionReview.findUniqueOrThrow({ where: { id: params.reviewId } })
        },
    }),
} as const
