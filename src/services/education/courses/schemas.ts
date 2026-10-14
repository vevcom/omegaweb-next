import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().max(40, 'Maks 40').min(3, 'min 3').trim(),
    code: z.string().max(12, 'Maks 12').min(3, 'min 3').trim(),
    ectsPoints: z.coerce.number().min(1, 'min 1'),
    schoolId: z.coerce.number().int(),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    schoolId: z.number(),
})

const courseId = paramsFieldSchemas.pick({
    id: true,
})

export const courseSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            name: true,
            code: true,
            ectsPoints: true,
            schoolId: true,
        }),
        update: dataFieldSchemas.pick({
            name: true,
            code: true,
            ectsPoints: true,
        }).partial(),
    },
    params: {
        read: courseId,
        readMany: paramsFieldSchemas.pick({
            schoolId: true,
        }).partial(),
        update: courseId,
        destroy: courseId,
    },
}
