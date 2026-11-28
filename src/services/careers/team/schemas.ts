import { z } from 'zod'

export const careersTeamDataFieldSchemas = z.object({
    name: z.string().trim().min(1, 'Navnet kan ikke være tomt').max(50, 'Maks lengde er 50 tegn'),
    direction: z.enum(['UP', 'DOWN']),
})

export const careersTeamParamsFieldSchemas = z.object({
    departmentId: z.number(),
})
