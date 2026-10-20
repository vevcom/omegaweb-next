import '@pn-server-only'
import { manualReviewAuth } from './auth'
import { manualReviewSchemas } from './schemas'
import { manualReviewProblemDescriptions } from './constants'
import { Smorekopp } from '@/services/error'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import logger from '@/lib/logger'

/**
 * Flags something for a human: logs "MANUAL ADMIN ACTION REQUIRED!" and records a
 * ManualTransactionReview. The description defaults to the problem's own, so callers only pass
 * one to add details, or to say what the review is about when it has no transaction or payment.
 * Never throws, since every caller is a best-effort path.
 */
const create = defineSubOperation({
    paramsSchema: () => manualReviewSchemas.params.create,
    operation: () => async ({ prisma, params }) => {
        const subject = `transaksjon ${params.transactionId ?? '-'}, betaling ${params.paymentId ?? '-'}`
        const problemDescription = params.problemDescription ?? manualReviewProblemDescriptions[params.problem]
        try {
            logger.error(
                `MANUAL ADMIN ACTION REQUIRED! ${problemDescription} (${subject})`,
                params.error && { error: params.error }
            )
            await prisma.manualTransactionReview.create({
                data: {
                    transactionId: params.transactionId,
                    paymentId: params.paymentId,
                    problem: params.problem,
                    problemDescription,
                },
            })
        } catch (error) {
            logger.error(`MANUAL ADMIN ACTION REQUIRED! Could not record a manual review (${subject}).`, { error })
        }
    },
})

export const manualReviewOperations = {
    internal: {
        create,
    },

    /**
     * Lists the OPEN reviews, newest first, with the transaction and payment each one is about.
     * Admin-only, across every account, not scoped to one the caller is a party to.
     */
    readOpen: defineOperation({
        authorizer: () => manualReviewAuth.readOpen,
        operation: async ({ prisma }) => prisma.manualTransactionReview.findMany({
            where: { state: 'OPEN' },
            include: {
                transaction: {
                    select: { id: true, purpose: true, state: true, ledgerEntries: { select: { funds: true } } },
                },
                payment: {
                    select: {
                        id: true,
                        provider: true,
                        state: true,
                        funds: true,
                        ledgerTransactions: { select: { id: true }, orderBy: { id: 'asc' } },
                    },
                },
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
