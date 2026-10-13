import { Admission } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    userId: z.coerce.number(),
})

const paramsFieldSchemas = z.object({
    userId: z.coerce.number(),
    admission: z.nativeEnum(Admission),
})

const userId = paramsFieldSchemas.pick({
    userId: true,
})

export const admissionSchemas = {
    data: {
        createTrial: dataFieldSchemas.pick({
            userId: true,
        }),
    },
    params: {
        readTrial: userId,
        userCompletedTrials: userId,
        createTrial: paramsFieldSchemas.pick({
            admission: true,
        }),
    },
}
