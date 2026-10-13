import { userDataFieldSchemas, userSchemas } from '@/services/users/schemas'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    usernameOrEmail: z.string().min(1),
    fromUsername: z.string().min(1),
    toUsername: z.string().min(1),
})

const paramsFieldSchemas = z.object({
    token: z.string(),
    userId: z.number(),
})

/** The claims of a link Feide account token: who asked, and the Feide identity to move. */
export const linkFeideAccountClaimsSchema = z.object({
    sub: z.coerce.number(),
    feideUserId: z.coerce.number(),
    feideAccountId: z.string(),
    feideName: z.string(),
    feideEmail: z.string(),
}).transform(({ sub, ...claims }) => ({ targetUserId: sub, ...claims }))

const token = paramsFieldSchemas.pick({
    token: true,
})

const userId = paramsFieldSchemas.pick({
    userId: true,
})

export const authSchemas = {
    data: {
        sendResetPasswordEmail: userDataFieldSchemas.pick({
            email: true,
        }),
        resetPassword: userSchemas.data.updatePassword,
        sendLinkFeideAccountEmail: dataFieldSchemas.pick({
            usernameOrEmail: true,
        }),
        adminLinkFeideAccount: dataFieldSchemas.pick({
            fromUsername: true,
            toUsername: true,
        }),
    },
    params: {
        verifyEmail: token,
        verifyResetPasswordToken: token,
        resetPassword: token,
        sendLinkFeideAccountEmail: userId,
        readFeideLoginMatch: userId,
        verifyLinkFeideAccountToken: token,
        linkFeideAccount: token,
    },
}
