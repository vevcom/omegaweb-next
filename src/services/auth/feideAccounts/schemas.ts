import { z } from 'zod'

const fieldSchemas = z.object({
    id: z.string(),
    userId: z.number(),
    email: z.string().trim().toLowerCase(),
    expiresAt: z.date(),
    issuedAt: z.date(),
})

export const feideAccountSchemas = {
    create: fieldSchemas.pick({
        id: true,
        userId: true,
        email: true,
        expiresAt: true,
        issuedAt: true,
    }),
    updateEmail: fieldSchemas.pick({
        email: true,
    }),
} as const

const feideAccountId = z.object({
    feideAccountId: fieldSchemas.shape.id,
})

export const feideAccountParamsSchemas = {
    readUser: feideAccountId,
    updateEmail: feideAccountId,
} as const
