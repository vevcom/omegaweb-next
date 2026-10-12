import '@pn-server-only'
import { mailAuth } from './auth'
import { mailSchemas } from './schemas'
import { aliasOperations } from './alias/operations'
import { mailingListOperations } from './list/operations'
import { mailAddressExternalOperations } from './mailAddressExternal/operations'
import {
    readAliasTraversal,
    readGroupTraversal,
    readMailaddressExternalTraversal,
    readMailingListTraversal,
    readUserTraversal,
} from './traversal'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import type { MailFlowObject } from './types'
import type { UserBasic } from '@/services/users/types'
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
        dataSchema: mailSchemas.createAliasMailingListRelation,
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
        dataSchema: mailSchemas.createMailingListExternalRelation,
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
        dataSchema: mailSchemas.createMailingListUserRelation,
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
        dataSchema: mailSchemas.createMailingListGroupRelation,
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
        dataSchema: mailSchemas.destroyAliasMailingListRelation,
        authorizer: () => mailAuth.destroyAliasMailingListRelation,
        operation: async ({ prisma, data }): Promise<MailAliasMailingList> =>
            prisma.mailAliasMailingList.delete({
                where: {
                    mailAliasId_mailingListId: data,
                },
            }),
    }),

    destroyMailingListExternalRelation: defineOperation({
        dataSchema: mailSchemas.destroyMailingListExternalRelation,
        authorizer: () => mailAuth.destroyMailingListExternalRelation,
        operation: async ({ prisma, data }): Promise<MailingListMailAddressExternal> =>
            prisma.mailingListMailAddressExternal.delete({
                where: {
                    mailingListId_mailAddressExternalId: data,
                },
            }),
    }),

    destroyMailingListUserRelation: defineOperation({
        dataSchema: mailSchemas.destroyMailingListUserRelation,
        authorizer: () => mailAuth.destroyMailingListUserRelation,
        operation: async ({ prisma, data }): Promise<MailingListUser> =>
            prisma.mailingListUser.delete({
                where: {
                    mailingListId_userId: data,
                },
            }),
    }),

    destroyMailingListGroupRelation: defineOperation({
        dataSchema: mailSchemas.destroyMailingListGroupRelation,
        authorizer: () => mailAuth.destroyMailingListGroupRelation,
        operation: async ({ prisma, data }): Promise<MailingListGroup> =>
            prisma.mailingListGroup.delete({
                where: {
                    mailingListId_groupId: data,
                },
            }),
    }),

    readMailTraversal: defineOperation({
        paramsSchema: mailSchemas.readMailFlow,
        authorizer: () => mailAuth.readMailFlow,
        operation: async ({ prisma, params }): Promise<MailFlowObject> => {
            if (params.filter === 'alias') return readAliasTraversal(prisma, params.id)
            if (params.filter === 'mailingList') return readMailingListTraversal(prisma, params.id)
            if (params.filter === 'mailaddressExternal') return readMailaddressExternalTraversal(prisma, params.id)
            if (params.filter === 'group') return readGroupTraversal(prisma, params.id)
            if (params.filter === 'user') return readUserTraversal(prisma, params.id)
            throw new ServiceError('BAD PARAMETERS', `The filter ${params.filter} is not a valid MailListTypes`)
        },
    }),

    readMailOptions: defineOperation({
        authorizer: () => mailAuth.readMailOptions,
        operation: async (): Promise<{
            alias: MailAlias[],
            mailingList: MailingList[],
            mailaddressExternal: MailAddressExternal[],
            users: UserBasic[],
        }> => {
            const results = await Promise.all([
                aliasOperations.readMany({ bypassAuth: true }),
                mailingListOperations.readMany({ bypassAuth: true }),
                mailAddressExternalOperations.readMany({ bypassAuth: true }),
            ])

            return {
                alias: results[0],
                mailingList: results[1],
                mailaddressExternal: results[2],
                users: [],
            }
        },
    }),
} as const
