import '@pn-server-only'
import { mailAuth } from './auth'
import { mailAddressExternalAuth } from './mailAddressExternal/auth'
import { mailSchemas } from './schemas'
import { aliasOperations } from './alias/operations'
import { mailingListOperations } from './list/operations'
import { mailAddressExternalOperations } from './mailAddressExternal/operations'
import { mailTraversalOperations } from './traversal/operations'
import { defineOperation } from '@/services/serviceOperation'
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
        authorizer: () => mailAuth.createAliasMailingListRelation,
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
        authorizer: () => mailAuth.createMailingListExternalRelation,
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
        authorizer: () => mailAuth.createMailingListUserRelation,
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
        authorizer: () => mailAuth.createMailingListGroupRelation,
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
        authorizer: () => mailAuth.destroyAliasMailingListRelation,
        operation: async ({ prisma, data }): Promise<MailAliasMailingList> =>
            prisma.mailAliasMailingList.delete({
                where: {
                    mailAliasId_mailingListId: data,
                },
            }),
    }),

    destroyMailingListExternalRelation: defineOperation({
        dataSchema: mailSchemas.data.destroyMailingListExternalRelation,
        authorizer: () => mailAuth.destroyMailingListExternalRelation,
        operation: async ({ prisma, data }): Promise<MailingListMailAddressExternal> =>
            prisma.mailingListMailAddressExternal.delete({
                where: {
                    mailingListId_mailAddressExternalId: data,
                },
            }),
    }),

    destroyMailingListUserRelation: defineOperation({
        dataSchema: mailSchemas.data.destroyMailingListUserRelation,
        authorizer: () => mailAuth.destroyMailingListUserRelation,
        operation: async ({ prisma, data }): Promise<MailingListUser> =>
            prisma.mailingListUser.delete({
                where: {
                    mailingListId_userId: data,
                },
            }),
    }),

    destroyMailingListGroupRelation: defineOperation({
        dataSchema: mailSchemas.data.destroyMailingListGroupRelation,
        authorizer: () => mailAuth.destroyMailingListGroupRelation,
        operation: async ({ prisma, data }): Promise<MailingListGroup> =>
            prisma.mailingListGroup.delete({
                where: {
                    mailingListId_groupId: data,
                },
            }),
    }),

    readGroupTraversal: mailTraversalOperations.read.implement({
        authorizer: ({ params }) => mailAuth.readGroupTraversal.data({ groupId: params.id }),
        ownershipCheck: () => true,
        operationImplementationFields: { type: 'group' },
    }),

    readUserTraversal: mailTraversalOperations.read.implement({
        authorizer: ({ params }) => mailAuth.readUserTraversal.data({ userId: params.id }),
        ownershipCheck: () => true,
        operationImplementationFields: { type: 'user' },
    }),

    /** What the session may wire: the aliases and lists it reads, and the external addresses if it may list them. */
    readMailOptions: defineOperation({
        authorizer: () => mailAuth.readMailOptions,
        operation: async ({ session }): Promise<{
            alias: MailAlias[],
            mailingList: MailingList[],
            mailaddressExternal: MailAddressExternal[],
        }> => {
            const [alias, mailingList, mailaddressExternal] = await Promise.all([
                aliasOperations.readMany({}),
                mailingListOperations.readMany({}),
                mailAddressExternalAuth.readMany.auth(session).authorized
                    ? mailAddressExternalOperations.readMany({})
                    : [],
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
