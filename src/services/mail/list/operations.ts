import '@pn-server-only'
import { mailingListAuth } from './auth'
import { mailingListSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import type { MailingList } from '@/prisma-generated-pn-types'

export const mailingListOperations = {
    create: defineOperation({
        dataSchema: mailingListSchemas.data.create,
        authorizer: () => mailingListAuth.create,
        operation: async ({ prisma, data }): Promise<MailingList> =>
            prisma.mailingList.create({ data }),
    }),

    readMany: defineOperation({
        authorizer: () => mailingListAuth.readMany,
        operation: async ({ prisma }): Promise<MailingList[]> =>
            prisma.mailingList.findMany(),
    }),

    update: defineOperation({
        paramsSchema: mailingListSchemas.params.update,
        dataSchema: mailingListSchemas.data.update,
        authorizer: () => mailingListAuth.update,
        operation: async ({ prisma, params, data }): Promise<MailingList> =>
            prisma.mailingList.update({
                where: { id: params.id },
                data,
            }),
    }),

    destroy: defineOperation({
        paramsSchema: mailingListSchemas.params.destroy,
        authorizer: () => mailingListAuth.destroy,
        operation: async ({ prisma, params }): Promise<MailingList> =>
            prisma.mailingList.delete({
                where: { id: params.id },
            }),
    }),
} as const
