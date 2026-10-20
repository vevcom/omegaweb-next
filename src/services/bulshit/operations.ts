import '@pn-server-only'
import { bulshitAuth } from './auth'
import { bulshitSchemas } from './schemas'
import { bulshitFilterSelection } from './constants'
import { defineOperation } from '@/services/serviceOperation'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'

export const bulshitOperations = {
    create: defineOperation({
        authorizer: ({ params }) => bulshitAuth.create.data({ userId: params.bulshitPosterId }),
        dataSchema: bulshitSchemas.data.create,
        paramsSchema: bulshitSchemas.params.create,
        operation: async ({ prisma, data, params }) => {
            await prisma.bulshit.create({
                data: {
                    ...data,
                    bulshitPoster: {
                        connect: {
                            id: params.bulshitPosterId
                        }
                    }
                }
            })
        }
    }),
    readPage: defineOperation({
        paramsSchema: bulshitSchemas.params.readPage,
        authorizer: () => bulshitAuth.readPage,
        operation: async ({ prisma, params }) =>
            prisma.bulshit.findMany({
                // `timestamp` alone is not a total order - the dev seed gives a whole batch the
                // same one - while the cursor is `id`. Without `id` in the ordering a page
                // boundary falling inside a group of tied timestamps skips or repeats quotes.
                orderBy: [
                    { timestamp: 'desc' },
                    { id: 'desc' },
                ],
                ...cursorPagingSelection(params.paging.page),
                select: bulshitFilterSelection,
            })
    }),
} as const
