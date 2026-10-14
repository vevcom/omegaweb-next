import { z } from 'zod'

const dataFieldSchemas = z.object({
    building: z.string().trim().min(1),
    floor: z.coerce.number().int(),
})

export const lockerLocationSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            building: true,
            floor: true,
        }),
    },
}
