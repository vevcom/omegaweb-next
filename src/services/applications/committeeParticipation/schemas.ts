import { z } from 'zod'

const paramsFieldSchemas = z.object({
    participationId: z.number(),
    committeeId: z.number(),
})

export const committeeParticipationSchemas = {
    params: {
        read: paramsFieldSchemas.pick({
            participationId: true,
        }),
        readAll: paramsFieldSchemas.pick({
            committeeId: true,
        }),
    },
}
