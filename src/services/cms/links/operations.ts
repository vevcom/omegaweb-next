import '@pn-server-only'
import { cmsLinkSchemas } from './schemas'
import { defineSubOperation } from '@/services/serviceOperation'

export const cmsLinkOperations = {
    create: defineSubOperation({
        dataSchema: () => cmsLinkSchemas.data.create,
        operation: () => ({ data, prisma }) => prisma.cmsLink.create({ data })
    }),

    destroy: defineSubOperation({
        paramsSchema: () => cmsLinkSchemas.params.destroy,
        operation: () => async ({ params, prisma }) => {
            await prisma.cmsLink.delete({
                where: {
                    id: params.linkId
                }
            })
        }
    }),

    update: defineSubOperation({
        paramsSchema: () => cmsLinkSchemas.params.update,
        dataSchema: () => cmsLinkSchemas.data.update,
        operation: () => ({ prisma, params, data }) =>
            prisma.cmsLink.update({
                where: {
                    id: params.linkId
                },
                data
            })
    }),
} as const
