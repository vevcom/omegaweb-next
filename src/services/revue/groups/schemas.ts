import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().trim().min(2, 'Navnet må ha minst 2 tegn').max(30, 'Navnet kan ha maks 30 tegn'),
    committeeId: z.coerce.number().int(),
    order: z.coerce.number().int(),
})

const paramsFieldSchemas = z.object({
    revueGroupId: z.number(),
    revueId: z.number(),
    year: z.number(),
    name: z.string(),
})

const revueGroupId = paramsFieldSchemas.pick({ revueGroupId: true })

export const revueGroupSchemas = {
    data: {
        create: z.discriminatedUnion('type', [
            dataFieldSchemas.pick({ name: true }).extend({ type: z.literal('REVUE_SUB_GROUP') }),
            dataFieldSchemas.pick({ name: true, committeeId: true }).extend({ type: z.literal('COMMITTEE') }),
        ]),
        addToRevue: dataFieldSchemas.pick({ order: true }),
        update: dataFieldSchemas.pick({ name: true }),
    },
    params: {
        create: paramsFieldSchemas.pick({ revueId: true }),
        addToRevue: paramsFieldSchemas.pick({ revueId: true, revueGroupId: true }),
        readManyInRevue: paramsFieldSchemas.pick({ revueId: true }),
        readInRevue: paramsFieldSchemas.pick({ year: true, name: true }),
        update: revueGroupId,
        destroy: revueGroupId,
        articleSection: revueGroupId,
    },
}
