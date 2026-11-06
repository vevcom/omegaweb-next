import { Zpn } from '@/lib/fields/zpn'
import { z } from 'zod'

// A highlight is of either an event or a job ad, and the form sends 'NULL' for the other.
const targetId = z.literal('NULL').transform(() => null).or(z.coerce.number().int())

const dataFieldSchemas = z.object({
    eventId: targetId,
    jobAdId: targetId,
    start: Zpn.date({ label: 'Start' }),
    end: Zpn.date({ label: 'Slutt' }),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
})

const highlight = dataFieldSchemas.pick({
    eventId: true,
    jobAdId: true,
    start: true,
    end: true,
})

const id = paramsFieldSchemas.pick({
    id: true,
})

export const careerFrontpageHighlightSchemas = {
    data: {
        create: highlight,
        update: highlight,
    },
    params: {
        update: id,
        destroy: id,
    },
}
