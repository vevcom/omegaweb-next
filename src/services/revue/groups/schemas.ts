import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().trim().min(2, 'Navnet må ha minst 2 tegn').max(30, 'Navnet kan ha maks 30 tegn'),
})

const paramsFieldSchemas = z.object({
    groupId: z.number(),
    revueId: z.number(),
    year: z.number(),
    name: z.string(),
})

const groupId = paramsFieldSchemas.pick({ groupId: true })

export const revueGroupSchemas = {
    data: {
        create: dataFieldSchemas.pick({ name: true }),
        update: dataFieldSchemas.pick({ name: true }),
    },
    params: {
        create: paramsFieldSchemas.pick({ revueId: true }),
        read: paramsFieldSchemas.pick({ year: true, name: true }),
        update: groupId,
        destroy: groupId,
        updateArticleSection: groupId,
    },
}
