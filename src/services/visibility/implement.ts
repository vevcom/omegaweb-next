import '@pn-server-only'
import { visibilityOperations } from './operations'
import { ServiceError } from '@/services/error'
import { defineOperation, type PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { Authorizer } from '@/auth/authorizer/Authorizer'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { z } from 'zod'
import type { DoubleLevelVisibilityMatrix, VisibilityMatrix } from './types'
import type { Awaitable } from '@/lib/awaitable'

type Authorizers<
    ImplementationParamsSchema extends z.ZodType<unknown>,
> = {
    readDoubleLevelMatrix: (
        args: {
            prisma: PrismaPossibleTransaction<false>,
            params: z.infer<ImplementationParamsSchema>,
            doubleLevelMatrix: DoubleLevelVisibilityMatrix,
        }
    ) => Awaitable<Authorizer>
    updateRegularLevel: (
        args: {
            prisma: PrismaPossibleTransaction<false>,
            implementationParams: z.infer<ImplementationParamsSchema>,
            doubleLevelMatrix: DoubleLevelVisibilityMatrix,
        }
    ) => Awaitable<Authorizer>,
    updateAdminLevel: (
        args: {
            prisma: PrismaPossibleTransaction<false>,
            implementationParams: z.infer<ImplementationParamsSchema>,
            doubleLevelMatrix: DoubleLevelVisibilityMatrix,
        }
    ) => Awaitable<Authorizer>
}

export const visibilityIncluder = {
    requirements: {
        include: {
            conditions: true
        }
    }
} as const

type ReadVisibilityDoubleLevel<ImplementationParamsSchema extends z.ZodType<unknown>> = (
    args: {
        include: typeof visibilityIncluder,
        prisma: PrismaPossibleTransaction<false>,
        implementationParams: z.infer<ImplementationParamsSchema>
    }
) => Promise<{
    regularLevel: Prisma.VisibilityGetPayload<{ include: typeof visibilityIncluder }>,
    adminLevel: Prisma.VisibilityGetPayload<{ include: typeof visibilityIncluder }>
}>

export function implementDoubleLevelVisibilityOperations<
    const ImplementationParamsSchema extends z.ZodType<unknown>
>({
    implementationParamsSchema,
    authorizers,
    readDoubleLevel,
}: {
    implementationParamsSchema: ImplementationParamsSchema,
    authorizers: Authorizers<ImplementationParamsSchema>,
    readDoubleLevel: ReadVisibilityDoubleLevel<ImplementationParamsSchema>,
}) {
    const readDoubleLevelMatrixInternal = async ({
        prisma,
        params
    } : {
        prisma: PrismaPossibleTransaction<false>,
        params: z.infer<ImplementationParamsSchema>
    }): Promise<DoubleLevelVisibilityMatrix> => {
        const visibilties = await readDoubleLevel({
            prisma,
            implementationParams: params,
            include: visibilityIncluder
        })

        return {
            regularLevel: toMatrix(visibilties.regularLevel),
            adminLevel: toMatrix(visibilties.adminLevel)
        }
    }

    return {
        readDoubleLevelMatrixInternal,
        readDoubleLevelMatrix: defineOperation({
            paramsSchema: implementationParamsSchema,
            authorizer: async (args) =>
                authorizers.readDoubleLevelMatrix({
                    prisma: args.prisma,
                    params: args.params,
                    doubleLevelMatrix: await readDoubleLevelMatrixInternal({
                        params: args.params, prisma: args.prisma
                    })
                }),
            operation: async args => readDoubleLevelMatrixInternal({
                params: args.params,
                prisma: args.prisma
            })
        }),
        updateRegularLevel: visibilityOperations.update.implement<ImplementationParamsSchema>({
            implementationParamsSchema,
            authorizer: async (args) =>
                authorizers.updateRegularLevel({
                    prisma: args.prisma,
                    implementationParams: args.implementationParams,
                    doubleLevelMatrix: await readDoubleLevelMatrixInternal({
                        params: args.implementationParams, prisma: args.prisma
                    })
                }),
            ownershipCheck: async ({ params, prisma, implementationParams }) => (await readDoubleLevel({
                include: visibilityIncluder,
                prisma,
                implementationParams,
            })).regularLevel.id === params.visibilityId,
        }),
        updateAdminLevel: visibilityOperations.update.implement<ImplementationParamsSchema>({
            implementationParamsSchema,
            authorizer: async (args) =>
                authorizers.updateAdminLevel({
                    prisma: args.prisma,
                    implementationParams: args.implementationParams,
                    doubleLevelMatrix: await readDoubleLevelMatrixInternal({
                        params: args.implementationParams, prisma: args.prisma
                    })
                }),
            ownershipCheck: async ({ params, prisma, implementationParams }) => (await readDoubleLevel({
                include: visibilityIncluder,
                prisma,
                implementationParams,
            })).adminLevel.id === params.visibilityId,
            beforeRun: ({ data }) => {
                if (data.requirements.length === 0) {
                    throw new ServiceError('BAD DATA', 'Du må velge hvem som kan administrere')
                }
            }
        })
    } as const
}

export function toMatrix(visibility: Prisma.VisibilityGetPayload<{ include: typeof visibilityIncluder }>): VisibilityMatrix {
    return {
        requirements: visibility.requirements.map(requirement => ({
            conditions: requirement.conditions.map(condition => (
                condition.type === 'ORDER' ? {
                    groupId: condition.groupId,
                    type: condition.type,
                    order: condition.order
                } : {
                    groupId: condition.groupId,
                    type: condition.type,
                }
            ))
        }))
    }
}
