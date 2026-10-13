import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().max(40, 'Maks 40').min(3, 'min 3').trim(),
    code: z.string().max(12, 'Maks 12').min(3, 'min 3').trim(),
    ectspoints: z.coerce.number().min(1, 'min 1'),
})

const course = dataFieldSchemas.pick({
    name: true,
    code: true,
    ectspoints: true,
})

export const courseSchemas = {
    data: {
        create: course,
        update: course.partial(),
    },
}
