import '@pn-server-only'
import { mailAddressSchemas } from './schemas'
import { defineSubOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import type { Prisma } from '@/prisma-generated-pn-types'

/**
 * The addresses on our mail domains, a sub-service of the services whose rows have one: an alias,
 * and a user. An address is a `MailAddress` row, and its owner keeps the address in a column that
 * refers to the row, `MailAlias.address` and `User.vevenMailAddress`, so an address is one owner's
 * and the owner's column follows when the address changes. An owning service gets its operations
 * from `implementMailAddressOperations` in implement.ts: it creates the row with
 * `create.internalCall` in the transaction that writes its own row, and says who may `update` the
 * address and who may change its forwarding. What an address is on the mail server, a
 * mailbox whose mail is also sent on to the private email of those behind it, is the mail server
 * sync's, see lib/mailServerSync.
 */

/**
 * Throws when the address is another row's, saying what kind of owner has it. A write that loses
 * the race to another still fails, on the unique index.
 */
async function assertAddressIsFree(prisma: Prisma.TransactionClient, address: string, exceptId?: number) {
    const taken = await prisma.mailAddress.findUnique({
        where: { address },
        select: { id: true, alias: { select: { id: true } } },
    })
    if (!taken || taken.id === exceptId) return
    throw new ServiceError(
        'DUPLICATE',
        `${address} er allerede i bruk av ${taken.alias ? 'et alias' : 'en bruker'}.`,
    )
}

export const mailAddressOperations = {
    create: defineSubOperation({
        dataSchema: () => mailAddressSchemas.data.create,
        operation: () => async ({ prisma, data }) => {
            const address = `${data.localPart}@${data.domain}`
            await assertAddressIsFree(prisma, address)
            return prisma.mailAddress.create({ data: { address } })
        },
    }),

    /** Moves the address. The owner's column follows, and the mail server sync moves the mailbox with its mail. */
    update: defineSubOperation({
        paramsSchema: () => mailAddressSchemas.params.update,
        dataSchema: () => mailAddressSchemas.data.update,
        operation: () => async ({ prisma, params, data }) => {
            const address = `${data.localPart}@${data.domain}`
            await assertAddressIsFree(prisma, address, params.mailAddressId)
            return prisma.mailAddress.update({ where: { id: params.mailAddressId }, data: { address } })
        },
    }),

    updateForwarding: defineSubOperation({
        paramsSchema: () => mailAddressSchemas.params.updateForwarding,
        dataSchema: () => mailAddressSchemas.data.updateForwarding,
        operation: () => ({ prisma, params, data }) =>
            prisma.mailAddress.update({ where: { id: params.mailAddressId }, data }),
    }),

    /** For an owner that is deleted, in the same transaction and after its own row, which refers to the address. */
    destroy: defineSubOperation({
        paramsSchema: () => mailAddressSchemas.params.destroy,
        operation: () => ({ prisma, params }) =>
            prisma.mailAddress.delete({ where: { id: params.mailAddressId } }),
    }),
} as const
