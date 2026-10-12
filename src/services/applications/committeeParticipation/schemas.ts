import { z } from 'zod'

const fieldSchemas = z.object({
    participationId: z.number(),
    committeeId: z.number(),
})

export const committeeParticipationParamsSchemas = {
    read: fieldSchemas.pick({
        participationId: true,
    }),
    readAll: fieldSchemas.pick({
        committeeId: true,
    }),
}
