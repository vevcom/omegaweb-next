import '@pn-server-only'
import { mailAliasAuth } from './auth'
import { mailAliasSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import type { MailAlias } from '@/prisma-generated-pn-types'

export const aliasOperations = {
    create: defineOperation({
        dataSchema: mailAliasSchemas.create,
        authorizer: () => mailAliasAuth.create,
        operation: async ({ prisma, data }): Promise<MailAlias> =>
            prisma.mailAlias.create({ data }),
    }),

    readMany: defineOperation({
        authorizer: () => mailAliasAuth.readMany,
        operation: async ({ prisma }): Promise<MailAlias[]> =>
            prisma.mailAlias.findMany(),
    }),

    update: defineOperation({
        dataSchema: mailAliasSchemas.update,
        authorizer: () => mailAliasAuth.update,
        operation: async ({ prisma, data }): Promise<MailAlias> =>
            prisma.mailAlias.update({
                where: { id: data.id },
                data: {
                    address: data.address,
                    description: data.description,
                },
            }),
    }),

    destroy: defineOperation({
        paramsSchema: mailAliasSchemas.destroy,
        authorizer: () => mailAliasAuth.destroy,
        operation: async ({ prisma, params }): Promise<MailAlias> => {
            const alias = await prisma.mailAlias.findUniqueOrThrow({
                where: { id: params.id },
                select: { notificationChannel: true },
            })

            if (alias.notificationChannel.length) {
                throw new ServiceError(
                    'BAD PARAMETERS',
                    'Cannot delete a mailAlias that is connected to a notification channel.'
                )
            }

            return prisma.mailAlias.delete({
                where: { id: params.id },
            })
        },
    }),
} as const
