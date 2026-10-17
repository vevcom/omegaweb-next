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

/**
 * What a dot is given in the name of, appended to its reason - the event someone did not show up
 * to, say. Null when the reason stands on its own.
 */
type ReasonContext = {
    reasonContext: string | null,
}

const createInternal = defineSubOperation({
    paramsSchema: () => dotSchemas.params.createInternal,
    dataSchema: () => dotSchemas.data.createInternal,
    operation: ({ reasonContext }: ReasonContext) => async ({ prisma, params, data }) => prisma.dot.create({
        data: {
            ...data,
            reason: reasonWithContext(data.reason, reasonContext),
            accuserId: params.accuserId,
        },
    }),
})

/** Gives every one of the users a dot of the same value and reason. A user listed twice gets one. */
const createManyInternal = defineSubOperation({
    paramsSchema: () => dotSchemas.params.createManyInternal,
    dataSchema: () => dotSchemas.data.createManyInternal,
    operation: ({ reasonContext }: ReasonContext) => async ({ prisma, params, data }) => {
        const reason = reasonWithContext(data.reason, reasonContext)
        return prisma.dot.createMany({
            data: Array.from(new Set(data.userIds)).map(userId => ({
                userId,
                value: data.value,
                reason,
                accuserId: params.accuserId,
            })),
        })
    },
})

export const dotOperations = {
    internal: {
        createInternal,
        createManyInternal,
        numberOfActiveDotsForUser,
    },
    create: createInternal.implement({
        authorizer: ({ params }) => dotAuth.create.data({ userId: params.accuserId }),
        ownershipCheck: () => true,
        operationImplementationFields: { reasonContext: null },
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

function reasonWithContext(reason: string, context: string | null): string {
    if (context === null) return reason
    return reason ? `${reason} (${context})` : context
}
