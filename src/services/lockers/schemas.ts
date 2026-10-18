import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    building: z.string().trim().min(1),
    floor: z.coerce.number().int(),
    id: z.coerce.number().int().nonnegative(),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
})

const lockerId = paramsFieldSchemas.pick({
    id: true,
})

export const lockersSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            building: true,
            floor: true,
            id: true,
        }),
        // The number stays: it is what the QR code on the locker points at.
        update: dataFieldSchemas.pick({
            building: true,
            floor: true,
        }),
    },
    params: {
        read: lockerId,
        update: lockerId,
        destroy: lockerId,
        readPage: readPageInputSchemaObject(
            paramsFieldSchemas.pick({
                id: true,
            }),
            z.undefined(),
        ),
    },
}
