import { z } from 'zod'

const dataFieldSchemas = z.object({
    year: z.coerce.number().int('Året må være et heltall').min(1900, 'Året er for tidlig').max(2100, 'Året er for sent'),
    name: z.string().trim().min(2, 'Navnet må ha minst 2 tegn').max(30, 'Navnet kan ha maks 30 tegn'),
})

const paramsFieldSchemas = z.object({
    revueId: z.number(),
    year: z.number(),
})

const revueId = paramsFieldSchemas.pick({ revueId: true })

export const revueSchemas = {
    data: {
        create: dataFieldSchemas.pick({ year: true, name: true }),
        update: dataFieldSchemas.pick({ year: true, name: true }).partial(),
    },
    params: {
        read: paramsFieldSchemas.pick({ year: true }),
        update: revueId,
        destroy: revueId,
        updateArticle: revueId,
    },
}
