import { z } from 'zod'

const fieldSchemas = z.object({
    userId: z.number(),
    committeeParticipationId: z.number(),
    periodId: z.number(),
    text: z.string().trim().min(
        1, { message: 'Søknadsteksten kan ikke være tom.' }
    ).max(
        1000, { message: 'Søknadsteksten kan ikke være lengre enn 1000 tegn.' }
    ),
    priority: z.literal('UP').or(z.literal('DOWN'))
})

const applicationParams = fieldSchemas.pick({
    userId: true,
    committeeParticipationId: true,
})

export const applicationSchemas = {
    create: fieldSchemas.pick({
        text: true,
    }),

    update: fieldSchemas.pick({
        text: true,
        priority: true
    }).partial(),
}

export const applicationParamsSchemas = {
    readForUser: fieldSchemas.pick({
        userId: true,
        periodId: true,
    }),
    create: applicationParams,
    update: applicationParams,
    destroy: applicationParams,
}
