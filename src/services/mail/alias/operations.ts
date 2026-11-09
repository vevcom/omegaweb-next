import '@pn-server-only'
import { mailAliasAuth } from './auth'
import { mailAliasSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { visibilityOperations } from '@/services/visibility/operations'
import { implementVisibilityOperations } from '@/services/visibility/implement'
import { mailTraversalOperations } from '@/services/mail/traversal/operations'
import { markOwned, ownerVisibilityIncluder, readAliasOwnerMatrices, readMembershipsToMark } from '@/services/mail/owned'
import type { MailAlias } from '@/prisma-generated-pn-types'
import type { MailAliasWithOwned } from '@/services/mail/types'

/** The owners of an alias: pass it, or hold MAILSERVER_ADMIN. */
const visibility = implementVisibilityOperations({
    implementationParamsSchema: mailAliasSchemas.params.visibility,
    authorizers: {
        readMatrix: ({ matrix }) => mailAliasAuth.readVisibility.data({ visibility: matrix }),
        update: ({ matrix }) => mailAliasAuth.updateVisibility.data({ visibility: matrix }),
    },
    readVisibility: async ({ prisma, implementationParams, include }) => (
        await prisma.mailAlias.findUniqueOrThrow({
            where: { id: implementationParams.id },
            select: { ownerVisibility: { include } },
        })
    ).ownerVisibility,
    emptyMeans: 'REFUSED',
})

export const aliasOperations = {
    visibility,

    create: defineOperation({
        dataSchema: mailAliasSchemas.data.create,
        authorizer: ({ data }) => mailAliasAuth.create.data({ ownerVisibility: { requirements: data.ownerRequirements } }),
        transaction: 'RUNS_IN',
        operation: async ({ prisma, data: { ownerRequirements, ...data } }): Promise<MailAlias> => {
            const ownerVisibility = await visibilityOperations.createWithRequirements.internalCall({
                prisma,
                data: { requirements: ownerRequirements },
            })
            return prisma.mailAlias.create({
                data: { ...data, ownerVisibility: { connect: { id: ownerVisibility.id } } },
            })
        },
    }),

    readTraversal: mailTraversalOperations.read.implement({
        authorizer: async ({ params, prisma }) => mailAliasAuth.readTraversal.data({
            visibility: await visibility.readMatrixInternal({ prisma, params }),
            markOwnedByUserId: params.markOwnedByUserId,
        }),
        ownershipCheck: () => true,
        operationImplementationFields: { type: 'alias' },
    }),

    readMany: defineOperation({
        paramsSchema: mailAliasSchemas.params.readMany,
        authorizer: async ({ params, prisma }) => mailAliasAuth.readMany.data({
            aliasOwnerVisibilities: await readAliasOwnerMatrices({ prisma }),
            markOwnedByUserId: params.markOwnedByUserId,
        }),
        operation: async ({ prisma, params }, prismaWhereFilter): Promise<MailAliasWithOwned[]> => {
            const [aliases, memberships] = await Promise.all([
                prisma.mailAlias.findMany({ where: prismaWhereFilter, include: ownerVisibilityIncluder }),
                readMembershipsToMark({ prisma, userId: params.markOwnedByUserId }),
            ])
            return aliases.map(alias => markOwned(alias, memberships))
        },
    }),

    update: defineOperation({
        paramsSchema: mailAliasSchemas.params.update,
        dataSchema: mailAliasSchemas.data.update,
        authorizer: async ({ params, prisma }) => mailAliasAuth.update.data({
            visibility: await visibility.readMatrixInternal({ prisma, params }),
        }),
        operation: async ({ prisma, params, data }): Promise<MailAlias> =>
            prisma.mailAlias.update({
                where: { id: params.id },
                data,
            }),
    }),

    updateDescription: defineOperation({
        paramsSchema: mailAliasSchemas.params.updateDescription,
        dataSchema: mailAliasSchemas.data.updateDescription,
        authorizer: async ({ params, prisma }) => mailAliasAuth.updateDescription.data({
            visibility: await visibility.readMatrixInternal({ prisma, params }),
        }),
        operation: async ({ prisma, params, data }): Promise<MailAlias> =>
            prisma.mailAlias.update({
                where: { id: params.id },
                data,
            }),
    }),

    destroy: defineOperation({
        paramsSchema: mailAliasSchemas.params.destroy,
        authorizer: async ({ params, prisma }) => mailAliasAuth.destroy.data({
            visibility: await visibility.readMatrixInternal({ prisma, params }),
        }),
        transaction: 'RUNS_IN',
        operation: async ({ prisma, params }): Promise<MailAlias> => {
            const alias = await prisma.mailAlias.findUniqueOrThrow({
                where: { id: params.id },
                select: { notificationChannel: true },
            })

            if (alias.notificationChannel.length) {
                throw new ServiceError(
                    'BAD PARAMETERS',
                    'Kan ikke slette et e-postalias som er koblet til en varslingskanal.'
                )
            }

            const destroyed = await prisma.mailAlias.delete({
                where: { id: params.id },
            })
            await visibilityOperations.destroy.internalCall({
                prisma,
                params: { visibilityId: destroyed.ownerVisibilityId },
            })
            return destroyed
        },
    }),
} as const
