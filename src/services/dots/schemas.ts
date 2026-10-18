import { Zpn } from '@/lib/fields/zpn'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    value: z.coerce.number().int().min(
        1, 'Verdi må være et positivt heltall'
    ).max(
        100, 'Verdi kan ikke være større enn 100'
    ),
    reason: z.string().max(200, 'Begrunnelse kan ha maks 200 tegn').trim(),
    userId: z.coerce.number().int(),
    userIds: Zpn.numberListCheckboxFriendly({ label: 'Brukere' }).refine(
        userIds => userIds.length > 0, 'Velg minst én bruker'
    ),
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

const accuser = paramsFieldSchemas.pick({
    accuserId: true,
})

export const dotSchemas = {
    data: {
        createInternal: dataFieldSchemas.pick({
            value: true,
            reason: true,
            userId: true,
        }),
        createManyInternal: dataFieldSchemas.pick({
            value: true,
            reason: true,
            userIds: true,
        }),
        update: dataFieldSchemas.pick({
            value: true,
            reason: true,
        }).partial(),
    },
    params: {
        createInternal: accuser,
        createManyInternal: accuser,
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
