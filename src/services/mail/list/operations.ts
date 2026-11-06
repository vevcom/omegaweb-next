import '@pn-server-only'
import { mailingListAuth } from './auth'
import { mailingListSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { visibilityOperations } from '@/services/visibility/operations'
import { implementVisibilityOperations } from '@/services/visibility/implement'
import type { MailingList } from '@/prisma-generated-pn-types'

/** The owners of a mailing list: pass it, or hold MAILSERVER_ADMIN. */
const visibility = implementVisibilityOperations({
    implementationParamsSchema: mailingListSchemas.params.visibility,
    authorizers: {
        readMatrix: () => mailingListAuth.readVisibility,
        update: () => mailingListAuth.updateVisibility,
    },
    readVisibility: async ({ prisma, implementationParams, include }) => (
        await prisma.mailingList.findUniqueOrThrow({
            where: { id: implementationParams.id },
            select: { ownerVisibility: { include } },
        })
    ).ownerVisibility,
    emptyMeans: 'REFUSED',
})

export const mailingListOperations = {
    visibility,

    create: defineOperation({
        dataSchema: mailingListSchemas.data.create,
        authorizer: () => mailingListAuth.create,
        transaction: 'RUNS_IN',
        operation: async ({ prisma, data: { ownerRequirements, ...data } }): Promise<MailingList> => {
            const ownerVisibility = await visibilityOperations.createWithRequirements.internalCall({
                prisma,
                data: { requirements: ownerRequirements },
            })
            return prisma.mailingList.create({
                data: { ...data, ownerVisibility: { connect: { id: ownerVisibility.id } } },
            })
        },
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
        transaction: 'RUNS_IN',
        operation: async ({ prisma, params }): Promise<MailingList> => {
            const destroyed = await prisma.mailingList.delete({
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
