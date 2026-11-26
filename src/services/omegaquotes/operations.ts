import '@ow-server-only'
import { omegaquoteContract } from './contract'
import { omegaQuoteFilterSelection } from './constants'
import { newOmegaquoteNotificationChannel } from './newOmegaquoteNotificationChannel'
import { omegaLinks } from '@/app/(omegaweb)/links'
import { defineOperation } from '@/services/serviceOperation'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'

export const omegaquoteOperations = {
    create: defineOperation(omegaquoteContract.create, {
        authorizerData: ({ params }) => ({ userId: params.userPosterId }),
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

            await newOmegaquoteNotificationChannel.internal.createNotification.internalCall({
                data: {
                    title: 'Ny Omegaquote♪',
                    message: `${results.quote}\n - ${results.author}`,
                    url: omegaLinks.omegaquotes(),
                    audience: { permission: 'OMEGAQUOTES_USE' },
                },
            })
            return results
        }
    }),
    readPage: defineOperation(omegaquoteContract.readPage, {
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
