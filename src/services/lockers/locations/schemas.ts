import { z } from 'zod'

const dataFieldSchemas = z.object({
    building: z.string(),
    floor: z.coerce.number(),
})

export const lockerLocationSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            building: true,
            floor: true,
        }),
    },
}
