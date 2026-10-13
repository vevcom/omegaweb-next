import { z } from 'zod'

const dataFieldSchemas = z.object({
    text: z.string().trim().min(
        1, { message: 'Søknadsteksten kan ikke være tom.' }
    ).max(
        1000, { message: 'Søknadsteksten kan ikke være lengre enn 1000 tegn.' }
    ),
    priority: z.literal('UP').or(z.literal('DOWN'))
})

const paramsFieldSchemas = z.object({
    userId: z.number(),
    committeeParticipationId: z.number(),
    periodId: z.number(),
})

const application = paramsFieldSchemas.pick({
    userId: true,
    committeeParticipationId: true,
})

export const applicationSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            text: true,
        }),
        update: dataFieldSchemas.pick({
            text: true,
            priority: true
        }).partial(),
    },
    params: {
        readForUser: paramsFieldSchemas.pick({
            userId: true,
            periodId: true,
        }),
        create: application,
        update: application,
        destroy: application,
    },
}
