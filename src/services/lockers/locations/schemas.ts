import { z } from 'zod'

const dataFieldSchemas = z.object({
    building: z.string().trim().min(1),
    floor: z.coerce.number().int(),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
})

const location = dataFieldSchemas.pick({
    building: true,
    floor: true,
})

const locationId = paramsFieldSchemas.pick({
    id: true,
})

export const lockerLocationSchemas = {
    data: {
        create: location,
        update: location,
    },
    params: {
        update: locationId,
        destroy: locationId,
    },
}
