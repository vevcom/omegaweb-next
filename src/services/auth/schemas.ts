import { userSchema, userSchemas } from '@/services/users/schemas'
import { z } from 'zod'

const fieldSchemas = z.object({
    token: z.string(),
    userId: z.number(),
    usernameOrEmail: z.string().min(1),
    fromUsername: z.string().min(1),
    toUsername: z.string().min(1),
})

export const authSchemas = {
    sendResetPasswordEmail: userSchema.pick({
        email: true,
    }),
    resetPassword: userSchemas.updatePassword,
    sendLinkFeideAccountEmail: fieldSchemas.pick({
        usernameOrEmail: true,
    }),
    adminLinkFeideAccount: fieldSchemas.pick({
        fromUsername: true,
        toUsername: true,
    }),
    /** The claims of a link Feide account token: who asked, and the Feide identity to move. */
    linkFeideAccountClaims: z.object({
        sub: z.coerce.number(),
        feideUserId: z.coerce.number(),
        feideAccountId: z.string(),
        feideName: z.string(),
        feideEmail: z.string(),
    }).transform(({ sub, ...claims }) => ({ targetUserId: sub, ...claims })),
} as const

const token = fieldSchemas.pick({
    token: true,
})

const userId = fieldSchemas.pick({
    userId: true,
})

export const authParamsSchemas = {
    verifyEmail: token,
    verifyResetPasswordToken: token,
    resetPassword: token,
    sendLinkFeideAccountEmail: userId,
    readFeideLoginMatch: userId,
    verifyLinkFeideAccountToken: token,
    linkFeideAccount: token,
} as const
