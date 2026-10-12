import '@pn-server-only'
import { mailingListAuth } from './auth'
import { mailingListSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import type { MailingList } from '@/prisma-generated-pn-types'

export const mailingListOperations = {
    create: defineOperation({
        dataSchema: mailingListSchemas.create,
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
        dataSchema: mailingListSchemas.update,
        authorizer: () => mailingListAuth.update,
        operation: async ({ prisma, data }): Promise<MailingList> =>
            prisma.mailingList.update({
                where: { id: data.id },
                data: {
                    name: data.name,
                    description: data.description,
                },
            }),
    }),

    destroy: defineOperation({
        paramsSchema: mailingListSchemas.destroy,
        authorizer: () => mailingListAuth.destroy,
        operation: async ({ prisma, params }): Promise<MailingList> =>
            prisma.mailingList.delete({
                where: { id: params.id },
            }),
    }),
} as const
