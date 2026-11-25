import '@ow-server-only'
import { visibilityOperations } from './operations'
import { ServiceError } from '@/services/error'
import { defineOperation, defineSubOperation, type PrismaPossibleTransaction } from '@/services/serviceOperation'
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

// In the order they were saved in, which is the order the editor showed them in.
export const visibilityIncluder = {
    requirements: {
        orderBy: { id: 'asc' },
        include: {
            conditions: { orderBy: { id: 'asc' } },
        },
    },
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

type SingleAuthorizers<ImplementationParamsSchema extends z.ZodType<unknown>> = {
    readMatrix: (args: {
        prisma: PrismaPossibleTransaction<false>,
        params: z.infer<ImplementationParamsSchema>,
        matrix: VisibilityMatrix,
    }) => Awaitable<Authorizer>,
    update: (args: {
        prisma: PrismaPossibleTransaction<false>,
        implementationParams: z.infer<ImplementationParamsSchema>,
        matrix: VisibilityMatrix,
    }) => Awaitable<Authorizer>,
}

type ReadVisibility<ImplementationParamsSchema extends z.ZodType<unknown>> = (args: {
    include: typeof visibilityIncluder,
    prisma: PrismaPossibleTransaction<false>,
    implementationParams: z.infer<ImplementationParamsSchema>,
}) => Promise<Prisma.VisibilityGetPayload<{ include: typeof visibilityIncluder }>>

function matrixReader<ImplementationParamsSchema extends z.ZodType<unknown>>(
    readVisibility: ReadVisibility<ImplementationParamsSchema>,
) {
    return async ({ prisma, params }: {
        prisma: PrismaPossibleTransaction<false>,
        params: z.infer<ImplementationParamsSchema>,
    }): Promise<VisibilityMatrix> => toMatrix(await readVisibility({
        prisma,
        implementationParams: params,
        include: visibilityIncluder,
    }))
}

/**
 * Reading one visibility an owning service holds, such as who may register through a quota. For
 * an owner that changes the visibility itself, along with what it guards, and so has no use for
 * an update of its own.
 *
 * The owner creates the visibility with `internal.create` in the transaction that creates its own
 * row, changes it with `internal.update`, and destroys it with `internal.destroy` once that row is gone.
 */
export function implementVisibilityRead<
    const ImplementationParamsSchema extends z.ZodType<unknown>
>({
    implementationParamsSchema,
    authorizer,
    readVisibility,
}: {
    implementationParamsSchema: ImplementationParamsSchema,
    authorizer: SingleAuthorizers<ImplementationParamsSchema>['readMatrix'],
    readVisibility: ReadVisibility<ImplementationParamsSchema>,
}) {
    const matrixOf = matrixReader(readVisibility)

    return {
        internal: {
            readMatrix: defineSubOperation({
                paramsSchema: () => implementationParamsSchema,
                operation: () => ({ prisma, params }) => matrixOf({ prisma, params }),
            }),
            create: visibilityOperations.createWithRequirements,
            update: visibilityOperations.update,
            destroy: visibilityOperations.destroy,
        },

        readMatrix: defineOperation({
            paramsSchema: implementationParamsSchema,
            authorizer: async ({ params, prisma }) => authorizer({
                prisma,
                params,
                matrix: await matrixOf({ params, prisma }),
            }),
            operation: ({ params, prisma }) => matrixOf({ params, prisma }),
        }),
    } as const
}

/**
 * The operations of one visibility an owning service holds, such as who owns a mailing list.
 * `emptyMeans` says what an update to no requirements at all is: 'EVERYONE' lets it through,
 * 'REFUSED' rejects it, for a visibility where that would hand the resource to everyone.
 */
export function implementVisibilityOperations<
    const ImplementationParamsSchema extends z.ZodType<unknown>
>({
    implementationParamsSchema,
    authorizers,
    readVisibility,
    emptyMeans,
}: {
    implementationParamsSchema: ImplementationParamsSchema,
    authorizers: SingleAuthorizers<ImplementationParamsSchema>,
    readVisibility: ReadVisibility<ImplementationParamsSchema>,
    emptyMeans: 'EVERYONE' | 'REFUSED',
}) {
    const read = implementVisibilityRead({
        implementationParamsSchema,
        authorizer: authorizers.readMatrix,
        readVisibility,
    })
    const matrixOf = matrixReader(readVisibility)

    return {
        ...read,
        update: visibilityOperations.update.implement<ImplementationParamsSchema>({
            implementationParamsSchema,
            authorizer: async ({ implementationParams, prisma }) => authorizers.update({
                prisma,
                implementationParams,
                matrix: await matrixOf({ params: implementationParams, prisma }),
            }),
            ownershipCheck: async ({ params, prisma, implementationParams }) => (await readVisibility({
                include: visibilityIncluder,
                prisma,
                implementationParams,
            })).id === params.visibilityId,
            beforeRun: ({ data }) => {
                if (emptyMeans === 'REFUSED' && data.requirements.length === 0) {
                    throw new ServiceError('BAD DATA', 'Du må velge hvem som kan administrere')
                }
            },
        }),
    } as const
}

/**
 * The operations of the two visibilities an owning service holds as its regular and admin levels.
 * `internal.create` and `internal.destroy` take one level at a time.
 */
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
    const doubleLevelMatrixOf = async ({ prisma, params }: {
        prisma: PrismaPossibleTransaction<false>,
        params: z.infer<ImplementationParamsSchema>,
    }): Promise<DoubleLevelVisibilityMatrix> => {
        const visibilities = await readDoubleLevel({
            prisma,
            implementationParams: params,
            include: visibilityIncluder,
        })

        return {
            regularLevel: toMatrix(visibilities.regularLevel),
            adminLevel: toMatrix(visibilities.adminLevel),
        }
    }

    return {
        internal: {
            readDoubleLevelMatrix: defineSubOperation({
                paramsSchema: () => implementationParamsSchema,
                operation: () => ({ prisma, params }) => doubleLevelMatrixOf({ prisma, params }),
            }),
            create: visibilityOperations.createWithRequirements,
            destroy: visibilityOperations.destroy,
        },

        readDoubleLevelMatrix: defineOperation({
            paramsSchema: implementationParamsSchema,
            authorizer: async (args) =>
                authorizers.readDoubleLevelMatrix({
                    prisma: args.prisma,
                    params: args.params,
                    doubleLevelMatrix: await doubleLevelMatrixOf({
                        params: args.params, prisma: args.prisma
                    })
                }),
            operation: async args => doubleLevelMatrixOf({
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
                    doubleLevelMatrix: await doubleLevelMatrixOf({
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
                    doubleLevelMatrix: await doubleLevelMatrixOf({
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
            conditions: requirement.conditions.map(({ groupId, order, onlyActive, onlyAdmins }) => ({
                groupId,
                order,
                onlyActive,
                onlyAdmins,
            }))
        }))
    }
}
