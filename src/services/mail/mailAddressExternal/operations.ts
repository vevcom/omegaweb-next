import '@pn-server-only'
import { mailAddressExternalAuth } from './auth'
import { mailAddressExternalSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import type { MailAddressExternal } from '@/prisma-generated-pn-types'

export const mailAddressExternalOperations = {
    create: defineOperation({
        dataSchema: mailAddressExternalSchemas.data.create,
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
        paramsSchema: mailAddressExternalSchemas.params.update,
        dataSchema: mailAddressExternalSchemas.data.update,
        authorizer: () => mailAddressExternalAuth.update,
        operation: async ({ prisma, params, data }): Promise<MailAddressExternal> =>
            prisma.mailAddressExternal.update({
                where: { id: params.id },
                data,
            }),
    }),

    destroy: defineOperation({
        paramsSchema: mailAddressExternalSchemas.params.destroy,
        authorizer: () => mailAddressExternalAuth.destroy,
        operation: async ({ prisma, params }): Promise<MailAddressExternal> =>
            prisma.mailAddressExternal.delete({
                where: { id: params.id },
            }),
    }),
} as const
