import '@pn-server-only'
import { mailAddressExternalAuth } from './auth'
import { mailAddressExternalSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import type { MailAddressExternal } from '@/prisma-generated-pn-types'

export const mailAddressExternalOperations = {
    create: defineOperation({
        dataSchema: mailAddressExternalSchemas.create,
        authorizer: () => mailAddressExternalAuth.create,
        operation: async ({ prisma, data }): Promise<MailAddressExternal> =>
            prisma.mailAddressExternal.create({ data }),
    }),

    readMany: defineOperation({
        authorizer: () => mailAddressExternalAuth.readMany,
        operation: async ({ prisma }): Promise<MailAddressExternal[]> =>
            prisma.mailAddressExternal.findMany(),
    }),

    update: defineOperation({
        dataSchema: mailAddressExternalSchemas.update,
        authorizer: () => mailAddressExternalAuth.update,
        operation: async ({ prisma, data }): Promise<MailAddressExternal> =>
            prisma.mailAddressExternal.update({
                where: { id: data.id },
                data: {
                    address: data.address,
                    description: data.description,
                },
            }),
    }),

    destroy: defineOperation({
        paramsSchema: mailAddressExternalSchemas.destroy,
        authorizer: () => mailAddressExternalAuth.destroy,
        operation: async ({ prisma, params }): Promise<MailAddressExternal> =>
            prisma.mailAddressExternal.delete({
                where: { id: params.id },
            }),
    }),
} as const
