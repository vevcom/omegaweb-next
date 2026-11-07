import '@pn-server-only'
import { mailTraversalSchemas } from './schemas'
import {
    readAliasTraversal,
    readGroupTraversal,
    readMailaddressExternalTraversal,
    readMailingListTraversal,
    readUserTraversal,
} from './readers'
import { defineSubOperation } from '@/services/serviceOperation'
import { readMembershipsToMark } from '@/services/mail/owned'
import type { Prisma } from '@/prisma-generated-pn-client'
import type { MembershipFiltered } from '@/services/groups/types'
import type { MailFlowObject, MailListTypes } from '@/services/mail/types'

const readerOfType = {
    alias: readAliasTraversal,
    mailingList: readMailingListTraversal,
    mailaddressExternal: readMailaddressExternalTraversal,
    group: readGroupTraversal,
    user: readUserTraversal,
} as const satisfies Record<
    MailListTypes,
    (prisma: Prisma.TransactionClient, id: number, memberships: MembershipFiltered[]) => Promise<MailFlowObject>
>

/**
 * How mail reaches one node of the flow and where it goes on from it, with what the user asked
 * for owns or administrates marked. Implemented once per type of node, by the service of that node, on the
 * terms of reading the node itself.
 */
export const mailTraversalOperations = {
    read: defineSubOperation({
        paramsSchema: () => mailTraversalSchemas.params.read,
        operation: ({ type }: { type: MailListTypes }) => async ({ prisma, params }): Promise<MailFlowObject> =>
            readerOfType[type](prisma, params.id, await readMembershipsToMark({
                prisma,
                userId: params.markOwnedByUserId,
            })),
    }),
} as const
