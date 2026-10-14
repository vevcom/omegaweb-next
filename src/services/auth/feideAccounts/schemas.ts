import { z } from 'zod'

const dataFieldSchemas = z.object({
    id: z.string(),
    userId: z.number(),
    email: z.string().trim().toLowerCase(),
    expiresAt: z.date(),
    issuedAt: z.date(),
})

const paramsFieldSchemas = z.object({
    feideAccountId: z.string(),
})

const feideAccountId = paramsFieldSchemas.pick({
    feideAccountId: true,
})

export const feideAccountSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            id: true,
            userId: true,
            email: true,
            expiresAt: true,
            issuedAt: true,
        }),
        updateEmail: dataFieldSchemas.pick({
            email: true,
        }),
    },
    params: {
        readUser: feideAccountId,
        updateEmail: feideAccountId,
    },
}
