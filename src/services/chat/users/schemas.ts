import { z } from 'zod'

const paramsFieldSchemas = z.object({
    userId: z.number().int(),
})

const ofUser = paramsFieldSchemas.pick({ userId: true })

export const chatUserSchemas = {
    params: {
        optIn: ofUser,
        read: ofUser,
        readSpaces: ofUser,
    },
}
