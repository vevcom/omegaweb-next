import { siteNameSchema } from '@/lib/sites/site'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    usernameOrEmail: z.string().min(1),
    fromUsername: z.string().min(1),
    toUsername: z.string().min(1),
})

const paramsFieldSchemas = z.object({
    token: z.string(),
    userId: z.number(),
    site: siteNameSchema,
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
        sendLinkFeideAccountEmail: dataFieldSchemas.pick({
            usernameOrEmail: true,
        }),
        adminLinkFeideAccount: dataFieldSchemas.pick({
            fromUsername: true,
            toUsername: true,
        }),
    },
    params: {
        sendLinkFeideAccountEmail: paramsFieldSchemas.pick({ userId: true, site: true }),
        readFeideLoginMatch: userId,
        verifyLinkFeideAccountToken: token,
        linkFeideAccount: token,
    },
}
