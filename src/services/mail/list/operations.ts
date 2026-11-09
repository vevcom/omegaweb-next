import '@pn-server-only'
import { mailingListAuth } from './auth'
import { mailingListSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { visibilityOperations } from '@/services/visibility/operations'
import { implementVisibilityOperations } from '@/services/visibility/implement'
import { mailTraversalOperations } from '@/services/mail/traversal/operations'
import {
    markOwned, ownerVisibilityIncluder, readMailingListOwnerMatrices, readMembershipsToMark,
} from '@/services/mail/owned'
import type { MailingList } from '@/prisma-generated-pn-types'
import type { MailingListWithOwned } from '@/services/mail/types'

/** The owners of a mailing list: pass it, or hold MAILSERVER_ADMIN. */
const visibility = implementVisibilityOperations({
    implementationParamsSchema: mailingListSchemas.params.visibility,
    authorizers: {
        readMatrix: ({ matrix }) => mailingListAuth.readVisibility.data({ visibility: matrix }),
        update: ({ matrix }) => mailingListAuth.updateVisibility.data({ visibility: matrix }),
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
        authorizer: ({ data }) => mailingListAuth.create.data({ ownerVisibility: { requirements: data.ownerRequirements } }),
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

    readTraversal: mailTraversalOperations.read.implement({
        authorizer: async ({ params, prisma }) => mailingListAuth.readTraversal.data({
            visibility: await visibility.readMatrixInternal({ prisma, params }),
            markOwnedByUserId: params.markOwnedByUserId,
        }),
        ownershipCheck: () => true,
        operationImplementationFields: { type: 'mailingList' },
    }),

    readMany: defineOperation({
        paramsSchema: mailingListSchemas.params.readMany,
        authorizer: async ({ params, prisma }) => mailingListAuth.readMany.data({
            mailingListOwnerVisibilities: await readMailingListOwnerMatrices({ prisma }),
            markOwnedByUserId: params.markOwnedByUserId,
        }),
        operation: async ({ prisma, params }, prismaWhereFilter): Promise<MailingListWithOwned[]> => {
            const [lists, memberships] = await Promise.all([
                prisma.mailingList.findMany({ where: prismaWhereFilter, include: ownerVisibilityIncluder }),
                readMembershipsToMark({ prisma, userId: params.markOwnedByUserId }),
            ])
            return lists.map(list => markOwned(list, memberships))
        },
    }),

    update: defineOperation({
        paramsSchema: mailingListSchemas.params.update,
        dataSchema: mailingListSchemas.data.update,
        authorizer: async ({ params, prisma }) => mailingListAuth.update.data({
            visibility: await visibility.readMatrixInternal({ prisma, params }),
        }),
        operation: async ({ prisma, params, data }): Promise<MailingList> =>
            prisma.mailingList.update({
                where: { id: params.id },
                data,
            }),
    }),

    destroy: defineOperation({
        paramsSchema: mailingListSchemas.params.destroy,
        authorizer: async ({ params, prisma }) => mailingListAuth.destroy.data({
            visibility: await visibility.readMatrixInternal({ prisma, params }),
        }),
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
