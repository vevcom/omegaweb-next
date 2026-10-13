import { OmegaMembershipLevel } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    order: z.coerce.number().int().min(1),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    userId: z.number(),
    omegaMembershipLevel: z.nativeEnum(OmegaMembershipLevel),
    /**
     * When set, a user who already sits at the wanted level or a higher one is left alone.
     */
    onlyUpgrade: z.boolean().default(false),
})

const user = paramsFieldSchemas.pick({
    userId: true,
})

export const omegaMembershipGroupSchemas = {
    data: {
        updateUserOrder: dataFieldSchemas.pick({
            order: true,
        }),
    },
    params: {
        read: z.union([
            paramsFieldSchemas.pick({ id: true }),
            paramsFieldSchemas.pick({ omegaMembershipLevel: true }),
        ]),
        readUserLevel: user,
        inferUserLevel: user,
        updateUserOrder: user,
        updateUserLevel: paramsFieldSchemas.pick({
            userId: true,
            omegaMembershipLevel: true,
            onlyUpgrade: true,
        }),
    },
}
