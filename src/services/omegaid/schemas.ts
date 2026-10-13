import { z } from 'zod'

const paramsFieldSchemas = z.object({
    userId: z.number(),
})

export const omegaIdSchemas = {
    params: {
        generate: paramsFieldSchemas.pick({
            userId: true,
        }),
    },
}
