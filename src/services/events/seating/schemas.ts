import { MAX_SEATS_PER_TABLE, MAX_TABLES, MAX_WISHES } from './plan'
import { Zpn } from '@/lib/fields/zpn'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    wishesEnd: Zpn.date({ label: 'Frist for ønsker' }),
    wishes: Zpn.json({
        label: 'Ønsker',
        schema: z.array(z.number().int()).max(MAX_WISHES, `Du kan ønske deg maks ${MAX_WISHES} personer`),
    }),
    seats: Zpn.json({
        label: 'Bord',
        schema: z.array(z.number().int().min(1).max(MAX_SEATS_PER_TABLE)).min(1).max(MAX_TABLES),
    }),
    placements: Zpn.json({
        label: 'Plassering',
        schema: z.array(z.object({
            registrationId: z.number().int(),
            table: z.number().int().min(0),
            seat: z.number().int().min(0),
            locked: z.boolean(),
        })),
    }),
    published: Zpn.checkboxOrBoolean({ label: 'Publisert' }),
    version: z.coerce.number().int().min(0),
})

const paramsFieldSchemas = z.object({
    id: z.number().int(),
})

const eventId = paramsFieldSchemas.pick({ id: true })

export const eventSeatingSchemas = {
    data: {
        openWishes: dataFieldSchemas.pick({ wishesEnd: true }),
        updateWishes: dataFieldSchemas.pick({ wishes: true }),
        savePlan: dataFieldSchemas.pick({ seats: true, placements: true, version: true }),
        setPublished: dataFieldSchemas.pick({ published: true }),
    },
    params: {
        readBoard: eventId,
        readOwn: eventId,
        openWishes: eventId,
        updateWishes: eventId,
        savePlan: eventId,
        setPublished: eventId,
    },
}
