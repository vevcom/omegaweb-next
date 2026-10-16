import '@pn-server-only'
import { dotAuth } from './auth'
import { dotSchemas } from './schemas'
import { dotsIncluder } from './constants'
import { expandDots } from './expandDots'
import { defineOperation, defineSubOperation, type PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { DotExpanded } from './types'

const numberOfActiveDotsForUser = defineSubOperation({
    paramsSchema: () => dotSchemas.params.numberOfActiveDotsForUser,
    operation: () => async ({ prisma, params }) => {
        const expandedDots = await readExpandedDotsOfUser(prisma, params.userId)
        return expandedDots.reduce((total, dot) => total + dot.valueLeft, 0)
    },
})

const createInternal = defineSubOperation({
    paramsSchema: () => dotSchemas.params.createInternal,
    dataSchema: () => dotSchemas.data.createInternal,
    operation: () => async ({ prisma, params, data }) => prisma.dot.create({
        data: {
            ...data,
            accuserId: params.accuserId,
        },
    }),
})

export const dotOperations = {
    internal: {
        createInternal,
        numberOfActiveDotsForUser,
    },
    create: createInternal.implement({
        authorizer: ({ params }) => dotAuth.create.data({ userId: params.accuserId }),
        ownershipCheck: () => true,
    }),

    update: defineOperation({
        paramsSchema: dotSchemas.params.update,
        dataSchema: dotSchemas.data.update,
        authorizer: () => dotAuth.update,
        operation: async ({ prisma, params, data }) => prisma.dot.update({
            where: {
                id: params.id,
            },
            data,
        }),
    }),

    destroy: defineOperation({
        paramsSchema: dotSchemas.params.destroy,
        authorizer: () => dotAuth.destroy,
        operation: async ({ prisma, params }) => prisma.dot.delete({
            where: {
                id: params.id,
            },
        }),
    }),

    /**
     * Reads the dots of a user, expanded with the expiry of each dot value. Since expiry is infered
     * from the whole queue of dots, all dots of the user are read even when only the active ones are
     * returned - an expired dot still decides when the dots after it start expiring.
     *
     * @returns The dots in ascending order of expiry, i.e the dot that expires first comes first.
     */
    readForUser: defineOperation({
        paramsSchema: dotSchemas.params.readForUser,
        authorizer: ({ params }) => dotAuth.readForUser.data({ userId: params.userId }),
        operation: async ({ prisma, params }): Promise<DotExpanded[]> => {
            const expandedDots = await readExpandedDotsOfUser(prisma, params.userId)
            return params.onlyActive ? expandedDots.filter(dot => dot.valueLeft > 0) : expandedDots
        },
    }),
} as const

/**
 * Every dot of the user, expanded with the expiry of each dot value. All of them are needed even
 * when only the active ones are wanted, since expiry is inferred from the whole queue of dots.
 */
async function readExpandedDotsOfUser(prisma: PrismaPossibleTransaction<false>, userId: number) {
    const [dots, freezePeriods] = await Promise.all([
        prisma.dot.findMany({
            where: {
                userId,
            },
            include: dotsIncluder,
        }),
        prisma.dotFreezePeriod.findMany(),
    ])
    return expandDots(dots, freezePeriods)
}
