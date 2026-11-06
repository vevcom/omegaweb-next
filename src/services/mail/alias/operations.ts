import '@pn-server-only'
import { mailAliasAuth } from './auth'
import { mailAliasSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { visibilityOperations } from '@/services/visibility/operations'
import { implementVisibilityOperations } from '@/services/visibility/implement'
import type { MailAlias } from '@/prisma-generated-pn-types'

/** The owners of an alias: pass it, or hold MAILSERVER_ADMIN. */
const visibility = implementVisibilityOperations({
    implementationParamsSchema: mailAliasSchemas.params.visibility,
    authorizers: {
        readMatrix: () => mailAliasAuth.readVisibility,
        update: () => mailAliasAuth.updateVisibility,
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
        authorizer: () => mailAliasAuth.create,
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

    readMany: defineOperation({
        authorizer: () => mailAliasAuth.readMany,
        operation: async ({ prisma }): Promise<MailAlias[]> =>
            prisma.mailAlias.findMany(),
    }),

    update: defineOperation({
        paramsSchema: mailAliasSchemas.params.update,
        dataSchema: mailAliasSchemas.data.update,
        authorizer: () => mailAliasAuth.update,
        operation: async ({ prisma, params, data }): Promise<MailAlias> =>
            prisma.mailAlias.update({
                where: { id: params.id },
                data,
            }),
    }),

    destroy: defineOperation({
        paramsSchema: mailAliasSchemas.params.destroy,
        authorizer: () => mailAliasAuth.destroy,
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
