import { Zpn } from '@/lib/fields/zpn'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    start: Zpn.date({ label: 'Start' }),
    end: Zpn.date({ label: 'Slutt' }),
    reason: z.string().max(200, 'Begrunnelse kan ha maks 200 tegn').trim(),
})

const paramsFieldSchemas = z.object({
    id: z.coerce.number(),
})

const freezePeriodEndsAfterStart = [
    (data: { start: Date, end: Date }) => data.start < data.end,
    'Frysperioden må slutte etter at den starter.',
] as const

const freezePeriod = dataFieldSchemas.pick({
    start: true,
    end: true,
    reason: true,
}).refine(...freezePeriodEndsAfterStart)

const freezePeriodId = paramsFieldSchemas.pick({
    id: true,
})

export const dotFreezePeriodSchemas = {
    data: {
        create: freezePeriod,
        update: freezePeriod,
    },
    params: {
        update: freezePeriodId,
        destroy: freezePeriodId,
    },
}
