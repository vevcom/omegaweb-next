import '@pn-server-only'
import { bullshitAuth } from './auth'
import { bullshitSchemas } from './schemas'
import { bullshitFilterSelection } from './constants'
import { defineOperation } from '@/services/serviceOperation'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'

export const bullshitOperations = {
    create: defineOperation({
        authorizer: ({ params }) => bullshitAuth.create.data({ userId: params.bullshitPosterId }),
        dataSchema: bullshitSchemas.data.create,
        paramsSchema: bullshitSchemas.params.create,
        operation: async ({ prisma, data, params }) => {
            await prisma.bullshit.create({
                data: {
                    ...data,
                    bullshitPoster: {
                        connect: {
                            id: params.bullshitPosterId
                        }
                    }
                }
            })
        }
    }),
    readPage: defineOperation({
        paramsSchema: bullshitSchemas.params.readPage,
        authorizer: () => bullshitAuth.readPage,
        operation: async ({ prisma, params }) =>
            prisma.bullshit.findMany({
                // `timestamp` alone is not a total order - the dev seed gives a whole batch the
                // same one - while the cursor is `id`. Without `id` in the ordering a page
                // boundary falling inside a group of tied timestamps skips or repeats quotes.
                orderBy: [
                    { timestamp: 'desc' },
                    { id: 'desc' },
                ],
                ...cursorPagingSelection(params.paging.page),
                select: bullshitFilterSelection,
            })
    }),
} as const
