import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().trim().min(1, 'Navnet kan ikke være tomt').max(100, 'Maks lengde er 100 tegn'),
    title: z.string().trim().min(1, 'Tittelen kan ikke være tom').max(100, 'Maks lengde er 100 tegn'),
    email: z.union([
        z.literal('').transform(() => null),
        z.string().trim().toLowerCase().email('Ugyldig e-postadresse')
            .max(200, 'Maks lengde er 200 tegn'),
    ]).nullable(),
    direction: z.enum(['UP', 'DOWN']),
})

const paramsFieldSchemas = z.object({
    cmsPersonId: z.number(),
})

const cmsPersonId = paramsFieldSchemas.pick({
    cmsPersonId: true,
})

export const cmsPersonSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            name: true,
            title: true,
            email: true,
        }).partial({ email: true }),
        update: dataFieldSchemas.pick({
            name: true,
            title: true,
            email: true,
        }).partial(),
        move: dataFieldSchemas.pick({
            direction: true,
        }),
    },
    params: {
        update: cmsPersonId,
        destroy: cmsPersonId,
        move: cmsPersonId,
    },
}
