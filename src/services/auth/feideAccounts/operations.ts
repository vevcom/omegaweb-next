import '@pn-server-only'
import { feideAccountSchemas } from './schemas'
import { defineSubOperation } from '@/services/serviceOperation'
import { userPartitions } from '@/services/users/constants'

/**
 * This is an internal service meant to be called from other auth related services.
 */
export const feideAccountOperations = {
    create: defineSubOperation({
        dataSchema: () => feideAccountSchemas.data.create,
        operation: () => ({ prisma, data: { userId, ...feideAccount } }) => prisma.feideAccount.create({
            data: {
                ...feideAccount,
                user: { connect: { id: userId } },
            },
        }),
    }),

    /** The user a Feide account is linked to - null when there is no account with the id. */
    readUser: defineSubOperation({
        paramsSchema: () => feideAccountSchemas.params.readUser,
        operation: () => async ({ prisma, params }) => {
            const feideAccount = await prisma.feideAccount.findUnique({
                where: { id: params.feideAccountId, user: userPartitions.unarchived },
                select: { user: true },
            })
            return feideAccount?.user ?? null
        },
    }),

    updateEmail: defineSubOperation({
        paramsSchema: () => feideAccountSchemas.params.updateEmail,
        dataSchema: () => feideAccountSchemas.data.updateEmail,
        operation: () => ({ prisma, params, data }) => prisma.feideAccount.update({
            where: { id: params.feideAccountId },
            data,
        }),
    }),
} as const
