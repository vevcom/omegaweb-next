import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string()
        .min(3, 'Navn må ha minst 3 tegn')
        .max(30, 'Navn kan ha maks 30 tegn')
        .trim(),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    interestGroupId: z.number(),
})

const interestGroupId = paramsFieldSchemas.pick({
    id: true,
})

export const interestGroupSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            name: true,
        }),
        update: dataFieldSchemas.partial().pick({
            name: true,
        }),
    },
    params: {
        read: interestGroupId,
        update: interestGroupId,
        destroy: interestGroupId,
        updateArticleSection: paramsFieldSchemas.pick({
            interestGroupId: true,
        }),
    },
}
