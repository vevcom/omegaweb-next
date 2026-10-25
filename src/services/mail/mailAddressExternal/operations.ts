import '@pn-server-only'
import { mailAddressExternalAuth } from './auth'
import { mailAddressExternalSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { userPartitions } from '@/services/users/constants'
import type { MailAddressExternal } from '@/prisma-generated-pn-types'
import type { Prisma } from '@/prisma-generated-pn-client'

export const mailAddressExternalOperations = {
    create: defineOperation({
        dataSchema: mailAddressExternalSchemas.data.create,
        authorizer: () => mailAddressExternalAuth.create,
        operation: async ({ prisma, data }): Promise<MailAddressExternal> => {
            await assertNotAUsersEmail(prisma, data.address)
            return prisma.mailAddressExternal.create({ data })
        },
    }),

    readMany: defineOperation({
        authorizer: () => mailAddressExternalAuth.readMany,
        operation: async ({ prisma }): Promise<MailAddressExternal[]> =>
            prisma.mailAddressExternal.findMany(),
    }),

    update: defineOperation({
        paramsSchema: mailAddressExternalSchemas.params.update,
        dataSchema: mailAddressExternalSchemas.data.update,
        authorizer: () => mailAddressExternalAuth.update,
        operation: async ({ prisma, params, data }): Promise<MailAddressExternal> => {
            await assertNotAUsersEmail(prisma, data.address)
            return prisma.mailAddressExternal.update({
                where: { id: params.id },
                data,
            })
        },
    }),

    destroy: defineOperation({
        paramsSchema: mailAddressExternalSchemas.params.destroy,
        authorizer: () => mailAddressExternalAuth.destroy,
        operation: async ({ prisma, params }): Promise<MailAddressExternal> =>
            prisma.mailAddressExternal.delete({
                where: { id: params.id },
            }),
    }),
} as const

/**
 * An external address is for people without a user. A user is added to a mailing list as a user, so
 * that the list follows their account when they change email.
 */
async function assertNotAUsersEmail(prisma: Prisma.TransactionClient, address: string) {
    const user = await prisma.user.findFirst({
        where: {
            email: { equals: address.trim(), mode: 'insensitive' },
            ...userPartitions.unarchived,
        },
        select: { username: true },
    })
    if (user) {
        throw new ServiceError(
            'BAD PARAMETERS',
            `Adressen tilhører brukeren ${user.username}. Legg til brukeren i stedet for en ekstern adresse.`
        )
    }
}
