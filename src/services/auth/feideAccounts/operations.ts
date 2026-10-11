import '@pn-server-only'
import { feideAccountParamsSchemas, feideAccountSchemas } from './schemas'
import { defineSubOperation } from '@/services/serviceOperation'

/**
 * This is an internal service meant to be called from other auth related services.
 */
export const feideAccountOperations = {
    create: defineSubOperation({
        dataSchema: () => feideAccountSchemas.create,
        operation: () => ({ prisma, data: { userId, ...feideAccount } }) => prisma.feideAccount.create({
            data: {
                ...feideAccount,
                user: { connect: { id: userId } },
            },
        }),
    }),

    /** The user a Feide account is linked to - null when there is no account with the id. */
    readUser: defineSubOperation({
        paramsSchema: () => feideAccountParamsSchemas.readUser,
        operation: () => async ({ prisma, params }) => {
            const feideAccount = await prisma.feideAccount.findUnique({
                where: { id: params.feideAccountId },
                select: { user: true },
            })
            return feideAccount?.user ?? null
        },
    }),

    updateEmail: defineSubOperation({
        paramsSchema: () => feideAccountParamsSchemas.updateEmail,
        dataSchema: () => feideAccountSchemas.updateEmail,
        operation: () => ({ prisma, params, data }) => prisma.feideAccount.update({
            where: { id: params.feideAccountId },
            data,
        }),
    }),
} as const
