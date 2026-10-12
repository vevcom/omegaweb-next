import { z } from 'zod'

const fieldSchemas = z.object({
    name: z.string().min(3),
    description: z.string(),
    shopId: z.coerce.number().int(),
    ledgerAccountId: z.coerce.number().int(),
})

export const shopSchemas = {
    create: fieldSchemas.pick({
        name: true,
        description: true,
    }),
    connectToLedger: fieldSchemas.pick({
        ledgerAccountId: true,
    }),
}

export const shopParamsSchemas = {
    read: fieldSchemas.pick({
        shopId: true,
    }),
    connectToLedger: fieldSchemas.pick({
        shopId: true,
    }),
}
