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
import type { Prisma } from '@/prisma-generated-pn-client'
import type { MailFlowObject, MailListTypes } from '@/services/mail/types'

const readerOfType = {
    alias: readAliasTraversal,
    mailingList: readMailingListTraversal,
    mailaddressExternal: readMailaddressExternalTraversal,
    group: readGroupTraversal,
    user: readUserTraversal,
} as const satisfies Record<MailListTypes, (prisma: Prisma.TransactionClient, id: number) => Promise<MailFlowObject>>

/**
 * How mail reaches one node of the flow and where it goes on from it. Implemented once per type of
 * node, by the service of that node, on the terms of reading the node itself.
 */
export const mailTraversalOperations = {
    read: defineSubOperation({
        paramsSchema: () => mailTraversalSchemas.params.read,
        operation: ({ type }: { type: MailListTypes }) => ({ prisma, params }): Promise<MailFlowObject> =>
            readerOfType[type](prisma, params.id),
    }),
} as const
