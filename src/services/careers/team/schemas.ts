import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().trim().min(1, 'Navnet kan ikke være tomt').max(50, 'Maks lengde er 50 tegn'),
    direction: z.enum(['UP', 'DOWN']),
})

const paramsFieldSchemas = z.object({
    departmentId: z.number(),
})

const departmentId = paramsFieldSchemas.pick({
    departmentId: true,
})

export const careersTeamSchemas = {
    data: {
        createDepartment: dataFieldSchemas.pick({
            name: true,
        }),
        updateDepartment: dataFieldSchemas.pick({
            name: true,
        }),
        moveDepartment: dataFieldSchemas.pick({
            direction: true,
        }),
    },
    params: {
        updateDepartment: departmentId,
        moveDepartment: departmentId,
        destroyDepartment: departmentId,
        createPerson: departmentId,
    },
}
