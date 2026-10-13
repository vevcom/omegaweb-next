import '@pn-server-only'
import { omegaQuotesAuth } from './auth'
import { omegaquoteSchemas } from './schemas'
import { omegaQuoteFilterSelection } from './constants'
import { notificationOperations } from '@/services/notifications/operations'
import { defineOperation } from '@/services/serviceOperation'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'

export const omegaquoteOperations = {
    create: defineOperation({
        authorizer: ({ params }) => omegaQuotesAuth.create.data({ userId: params.userPosterId }),
        dataSchema: omegaquoteSchemas.data.create,
        paramsSchema: omegaquoteSchemas.params.create,
        operation: async ({ prisma, data, params }) => {
            const results = await prisma.omegaQuote.create({
                data: {
                    ...data,
                    userPoster: {
                        connect: {
                            id: params.userPosterId
                        }
                    }
                }
            })

            notificationOperations.createSpecial.internalCall({
                params: {
                    special: 'NEW_OMEGAQUOTE',
                },
                data: {
                    title: 'Ny Omegaquote♪',
                    message: `${results.quote}\n - ${results.author}`,
                    audience: { permission: 'OMEGAQUOTES_USE' },
                },
            })
            return results
        }
    }),
    readPage: defineOperation({
        paramsSchema: omegaquoteSchemas.params.readPage,
        authorizer: () => omegaQuotesAuth.readPage,
        operation: async ({ prisma, params }) =>
            prisma.omegaQuote.findMany({
                orderBy: {
                    timestamp: 'desc',
                },
                ...cursorPagingSelection(params.paging.page),
                select: omegaQuoteFilterSelection,
            })
    }),
} as const
