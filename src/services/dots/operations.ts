import '@pn-server-only'
import { dotAuth } from './auth'
import { dotSchemas } from './schemas'
import { dotsIncluder } from './constants'
import { expandDots } from './expandDots'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import { z } from 'zod'
import type { DotExpanded } from './types'

const numberOfActiveDotsForUser = defineSubOperation({
    paramsSchema: () => z.object({
        userId: z.coerce.number(),
    }),
    operation: () => async ({ prisma, params }) => {
        const dots = await prisma.dot.findMany({
            where: {
                userId: params.userId,
            },
            include: dotsIncluder,
        })
        const freezePeriods = await prisma.dotFreezePeriod.findMany()

        const expandedDots = expandDots(dots, freezePeriods)

        return expandedDots.reduce((total, dot) => total + dot.valueLeft, 0)
    },
})

const createInternal = defineSubOperation({
    paramsSchema: () => z.object({
        accuserId: z.coerce.number(),
    }),
    dataSchema: () => dotSchemas.create,
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
        paramsSchema: z.object({
            id: z.coerce.number(),
        }),
        dataSchema: dotSchemas.update,
        authorizer: () => dotAuth.update,
        operation: async ({ prisma, params, data }) => prisma.dot.update({
            where: {
                id: params.id,
            },
            data,
        }),
    }),

    destroy: defineOperation({
        paramsSchema: z.object({
            id: z.coerce.number(),
        }),
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
        paramsSchema: z.object({
            userId: z.coerce.number(),
            onlyActive: z.boolean().default(false),
        }),
        authorizer: ({ params }) => dotAuth.readForUser.data({ userId: params.userId }),
        operation: async ({ prisma, params }): Promise<DotExpanded[]> => {
            const [dots, freezePeriods] = await Promise.all([
                prisma.dot.findMany({
                    where: {
                        userId: params.userId,
                    },
                    include: dotsIncluder,
                }),
                prisma.dotFreezePeriod.findMany(),
            ])

            const expandedDots = expandDots(dots, freezePeriods)

            return params.onlyActive ? expandedDots.filter(dot => dot.valueLeft > 0) : expandedDots
        },
    }),
} as const
