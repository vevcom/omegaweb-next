import '@pn-server-only'
import { visibilityOperations } from './operations'
import { isSubVisibility } from '@/auth/visibility/isSubVisibility'
import { ServiceError } from '@/services/error'
import { defineOperation, type PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { Authorizer } from '@/auth/authorizer/Authorizer'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { z } from 'zod'
import type { DoubleLevelVisibilityMatrix, VisibilityMatrix } from './types'

/**
 * The admin level must always be a sub-visibility of the regular level - an administrator who
 * cannot even see what they administrate is a broken state. Since either level can be updated on
 * its own, this is asserted on the pair that the update would result in, not on the stored pair.
 *
 * Exported so services that take both levels as part of creating the thing they guard can hold the
 * pair to the same invariant from the start.
 */
export function assertAdminLevelIsSubOfRegularLevel(resultingMatrix: DoubleLevelVisibilityMatrix): void {
    if (!isSubVisibility(resultingMatrix.adminLevel, resultingMatrix.regularLevel)) {
        throw new ServiceError(
            'BAD DATA',
            'Alle som kan administrere må også kunne se - det administrative nivået må ' +
            'være en delmengde av det vanlige nivået.'
        )
    }
}

type Authorizers<
    ImplementationParamsSchema extends z.ZodTypeAny,
> = {
    readDoubleLevelMatrix: (
        args: {
            prisma: PrismaPossibleTransaction<false>,
            params: z.infer<ImplementationParamsSchema>,
            doubleLevelMatrix: DoubleLevelVisibilityMatrix,
        }
    ) => Authorizer | Promise<Authorizer>
    updateRegularLevel: (
        args: {
            prisma: PrismaPossibleTransaction<false>,
            implementationParams: z.infer<ImplementationParamsSchema>,
            doubleLevelMatrix: DoubleLevelVisibilityMatrix,
        }
    ) => Authorizer | Promise<Authorizer>,
    updateAdminLevel: (
        args: {
            prisma: PrismaPossibleTransaction<false>,
            implementationParams: z.infer<ImplementationParamsSchema>,
            doubleLevelMatrix: DoubleLevelVisibilityMatrix,
        }
    ) => Authorizer | Promise<Authorizer>
}

export const visibilityIncluder = {
    requirements: {
        include: {
            conditions: true
        }
    }
} as const

type ReadVisibilityDoubleLevel<ImplementationParamsSchema extends z.ZodTypeAny> = (
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
    const ImplementationParamsSchema extends z.ZodTypeAny
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
            beforeRun: async ({ prisma, implementationParams, data }) => assertAdminLevelIsSubOfRegularLevel({
                regularLevel: { requirements: data.requirements },
                adminLevel: (await readDoubleLevelMatrixInternal({
                    params: implementationParams, prisma
                })).adminLevel
            })
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
            beforeRun: async ({ prisma, implementationParams, data }) => {
                if (data.requirements.length === 0) {
                    throw new ServiceError('BAD DATA', 'Du må velge hvem som kan administrere')
                }
                assertAdminLevelIsSubOfRegularLevel({
                    regularLevel: (await readDoubleLevelMatrixInternal({
                        params: implementationParams, prisma
                    })).regularLevel,
                    adminLevel: { requirements: data.requirements }
                })
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
