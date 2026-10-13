import { z } from 'zod'

const dataFieldSchemas = z.object({
    value: z.coerce.number().int().min(
        1, 'Verdi må være et positivt heltall'
    ).max(
        100, 'Verdi kan ikke være større enn 100'
    ),
    reason: z.string().max(200, 'Begrunnelse kan ha maks 200 tegn').trim(),
    userId: z.coerce.number().int(),
})

const paramsFieldSchemas = z.object({
    id: z.coerce.number(),
    userId: z.coerce.number(),
    accuserId: z.coerce.number(),
    onlyActive: z.boolean().default(false),
})

const dotId = paramsFieldSchemas.pick({
    id: true,
})

export const dotSchemas = {
    data: {
        createInternal: dataFieldSchemas.pick({
            value: true,
            reason: true,
            userId: true,
        }),
        update: dataFieldSchemas.pick({
            value: true,
            reason: true,
        }).partial(),
    },
    params: {
        createInternal: paramsFieldSchemas.pick({
            accuserId: true,
        }),
        numberOfActiveDotsForUser: paramsFieldSchemas.pick({
            userId: true,
        }),
        update: dotId,
        destroy: dotId,
        readForUser: paramsFieldSchemas.pick({
            userId: true,
            onlyActive: true,
        }),
    },
}
