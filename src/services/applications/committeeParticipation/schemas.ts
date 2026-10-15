import { z } from 'zod'

const paramsFieldSchemas = z.object({
    participationId: z.number(),
    committeeId: z.number(),
})

const participation = paramsFieldSchemas.pick({
    participationId: true,
})

export const committeeParticipationSchemas = {
    params: {
        read: participation,
        readAll: paramsFieldSchemas.pick({
            committeeId: true,
        }),
        updateParagraphContent: participation,
        updateVideoLink: participation,
    },
}
