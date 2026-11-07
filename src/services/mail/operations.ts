import '@pn-server-only'
import { mailAuth } from './auth'
import { mailSchemas } from './schemas'
import { aliasOperations } from './alias/operations'
import { mailingListOperations } from './list/operations'
import { mailAddressExternalOperations } from './mailAddressExternal/operations'
import { mailTraversalOperations } from './traversal/operations'
import { defineOperation } from '@/services/serviceOperation'
import { Smorekopp } from '@/services/error'
import type { MailListTypes } from './types'
import type {
    MailAlias,
    MailAliasMailingList,
    MailAddressExternal,
    MailingList,
    MailingListGroup,
    MailingListMailAddressExternal,
    MailingListUser,
} from '@/prisma-generated-pn-types'

export const mailOperations = {
    createAliasMailingListRelation: defineOperation({
        dataSchema: mailSchemas.data.createAliasMailingListRelation,
        authorizer: async ({ data, prisma }) => mailAuth.createAliasMailingListRelation.data({
            aliasVisibility: await aliasOperations.visibility.readMatrixInternal({
                prisma,
                params: { id: data.mailAliasId },
            }),
            listVisibility: await mailingListOperations.visibility.readMatrixInternal({
                prisma,
                params: { id: data.mailingListId },
            }),
        }),
        operation: async ({ prisma, data }): Promise<MailAliasMailingList> =>
            prisma.mailAliasMailingList.create({
                data: {
                    mailAlias: { connect: { id: data.mailAliasId } },
                    mailingList: { connect: { id: data.mailingListId } },
                },
            }),
    }),

    createMailingListExternalRelation: defineOperation({
        dataSchema: mailSchemas.data.createMailingListExternalRelation,
        authorizer: async ({ data, prisma }) => mailAuth.createMailingListExternalRelation.data({
            listVisibility: await mailingListOperations.visibility.readMatrixInternal({
                prisma,
                params: { id: data.mailingListId },
            }),
        }),
        operation: async ({ prisma, data }): Promise<MailingListMailAddressExternal> =>
            prisma.mailingListMailAddressExternal.create({
                data: {
                    mailingList: { connect: { id: data.mailingListId } },
                    mailAddressExternal: { connect: { id: data.mailAddressExternalId } },
                },
            }),
    }),

    createMailingListUserRelation: defineOperation({
        dataSchema: mailSchemas.data.createMailingListUserRelation,
        authorizer: async ({ data, prisma }) => mailAuth.createMailingListUserRelation.data({
            listVisibility: await mailingListOperations.visibility.readMatrixInternal({
                prisma,
                params: { id: data.mailingListId },
            }),
            userId: data.userId,
        }),
        operation: async ({ prisma, data }): Promise<MailingListUser> =>
            prisma.mailingListUser.create({
                data: {
                    mailingList: { connect: { id: data.mailingListId } },
                    user: { connect: { id: data.userId } },
                },
            }),
    }),

    createMailingListGroupRelation: defineOperation({
        dataSchema: mailSchemas.data.createMailingListGroupRelation,
        authorizer: async ({ data, prisma }) => mailAuth.createMailingListGroupRelation.data({
            listVisibility: await mailingListOperations.visibility.readMatrixInternal({
                prisma,
                params: { id: data.mailingListId },
            }),
            groupId: data.groupId,
        }),
        operation: async ({ prisma, data }): Promise<MailingListGroup> =>
            prisma.mailingListGroup.create({
                data: {
                    mailingList: { connect: { id: data.mailingListId } },
                    group: { connect: { id: data.groupId } },
                },
            }),
    }),

    destroyAliasMailingListRelation: defineOperation({
        dataSchema: mailSchemas.data.destroyAliasMailingListRelation,
        authorizer: async ({ data, prisma }) => mailAuth.destroyAliasMailingListRelation.data({
            aliasVisibility: await aliasOperations.visibility.readMatrixInternal({
                prisma,
                params: { id: data.mailAliasId },
            }),
            listVisibility: await mailingListOperations.visibility.readMatrixInternal({
                prisma,
                params: { id: data.mailingListId },
            }),
        }),
        operation: async ({ prisma, data }): Promise<MailAliasMailingList> =>
            prisma.mailAliasMailingList.delete({
                where: {
                    mailAliasId_mailingListId: data,
                },
            }),
    }),

    destroyMailingListExternalRelation: defineOperation({
        dataSchema: mailSchemas.data.destroyMailingListExternalRelation,
        authorizer: async ({ data, prisma }) => mailAuth.destroyMailingListExternalRelation.data({
            listVisibility: await mailingListOperations.visibility.readMatrixInternal({
                prisma,
                params: { id: data.mailingListId },
            }),
        }),
        operation: async ({ prisma, data }): Promise<MailingListMailAddressExternal> =>
            prisma.mailingListMailAddressExternal.delete({
                where: {
                    mailingListId_mailAddressExternalId: data,
                },
            }),
    }),

    destroyMailingListUserRelation: defineOperation({
        dataSchema: mailSchemas.data.destroyMailingListUserRelation,
        authorizer: async ({ data, prisma }) => mailAuth.destroyMailingListUserRelation.data({
            listVisibility: await mailingListOperations.visibility.readMatrixInternal({
                prisma,
                params: { id: data.mailingListId },
            }),
            userId: data.userId,
        }),
        operation: async ({ prisma, data }): Promise<MailingListUser> =>
            prisma.mailingListUser.delete({
                where: {
                    mailingListId_userId: data,
                },
            }),
    }),

    destroyMailingListGroupRelation: defineOperation({
        dataSchema: mailSchemas.data.destroyMailingListGroupRelation,
        authorizer: async ({ data, prisma }) => mailAuth.destroyMailingListGroupRelation.data({
            listVisibility: await mailingListOperations.visibility.readMatrixInternal({
                prisma,
                params: { id: data.mailingListId },
            }),
            groupId: data.groupId,
        }),
        operation: async ({ prisma, data }): Promise<MailingListGroup> =>
            prisma.mailingListGroup.delete({
                where: {
                    mailingListId_groupId: data,
                },
            }),
    }),

    readGroupTraversal: mailTraversalOperations.read.implement({
        authorizer: ({ params }) => mailAuth.readGroupTraversal.data({
            groupId: params.id,
            markOwnedByUserId: params.markOwnedByUserId,
        }),
        ownershipCheck: () => true,
        operationImplementationFields: { type: 'group' },
    }),

    readUserTraversal: mailTraversalOperations.read.implement({
        authorizer: ({ params }) => mailAuth.readUserTraversal.data({
            userId: params.id,
            markOwnedByUserId: params.markOwnedByUserId,
        }),
        ownershipCheck: () => true,
        operationImplementationFields: { type: 'user' },
    }),

    /**
     * What the session may wire: of aliases, lists and external addresses, those it may list, and
     * none of a kind it may not.
     */
    readMailOptions: defineOperation({
        authorizer: () => mailAuth.readMailOptions,
        operation: async (): Promise<{
            alias: MailAlias[],
            mailingList: MailingList[],
            mailaddressExternal: MailAddressExternal[],
        }> => {
            const [alias, mailingList, mailaddressExternal] = await Promise.all([
                noneWhenUnauthorized(aliasOperations.readMany({ params: {} })),
                noneWhenUnauthorized(mailingListOperations.readMany({ params: {} })),
                noneWhenUnauthorized(mailAddressExternalOperations.readMany({})),
            ])

            return { alias, mailingList, mailaddressExternal }
        },
    }),
} as const

/** The traversal read of each type of node, for a page that gets the type from its url. */
export const mailTraversalReadOfType = {
    alias: aliasOperations.readTraversal,
    mailingList: mailingListOperations.readTraversal,
    mailaddressExternal: mailAddressExternalOperations.readTraversal,
    group: mailOperations.readGroupTraversal,
    user: mailOperations.readUserTraversal,
} as const satisfies Record<MailListTypes, unknown>

function noneWhenUnauthorized<Row>(read: Promise<Row[]>): Promise<Row[]> {
    return read.catch((error: unknown) => {
        if (error instanceof Smorekopp && error.errorCode === 'UNAUTHORIZED') return []
        throw error
    })
}
