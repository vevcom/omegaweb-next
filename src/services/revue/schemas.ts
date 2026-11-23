import { Zpn } from '@/lib/fields/zpn'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    year: z.coerce.number().int('Året må være et heltall').min(1900, 'Året er for tidlig').max(2100, 'Året er for sent'),
    name: z.string().trim().min(2, 'Navnet må ha minst 2 tegn').max(30, 'Navnet kan ha maks 30 tegn'),
    themeBackground: Zpn.hexColor(),
    themePrimary: Zpn.hexColor(),
    themeSecondary: Zpn.hexColor(),
    themeAccent: Zpn.hexColor(),
})

const paramsFieldSchemas = z.object({
    revueId: z.number(),
    year: z.number(),
})

const revueFields = {
    year: true,
    name: true,
    themeBackground: true,
    themePrimary: true,
    themeSecondary: true,
    themeAccent: true,
} as const

const revueId = paramsFieldSchemas.pick({ revueId: true })

export const revueSchemas = {
    data: {
        create: dataFieldSchemas.pick(revueFields),
        update: dataFieldSchemas.pick(revueFields).partial(),
    },
    params: {
        read: paramsFieldSchemas.pick({ year: true }),
        update: revueId,
        destroy: revueId,
        article: revueId,
    },
}
