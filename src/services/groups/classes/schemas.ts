import { ClassLevel } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    level: z.nativeEnum(ClassLevel),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    level: z.nativeEnum(ClassLevel),
    userId: z.coerce.number(),
    order: z.coerce.number().optional(),
})

export const classSchemas = {
    data: {
        /** The class to move them into - what the form actually submits. */
        changeClassOfUser: dataFieldSchemas.pick({
            level: true,
        }),
    },
    params: {
        read: z.union([
            paramsFieldSchemas.pick({ id: true }),
            paramsFieldSchemas.pick({ level: true }),
        ]),
        readClassOfUser: paramsFieldSchemas.pick({
            userId: true,
        }),
        /**
         * Who is being moved, and in which order. The order defaults to the one the class groups are
         * currently in, which is where a class membership is normally created.
         */
        changeClassOfUser: paramsFieldSchemas.pick({
            userId: true,
            order: true,
        }),
    },
}
