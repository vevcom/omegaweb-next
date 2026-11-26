import { imageDataFieldSchemas } from '@/services/images/subservice/schemas'
import { z } from 'zod'

const paramsFieldSchemas = z.object({
    userId: z.number().int(),
})

const ofUser = paramsFieldSchemas.pick({ userId: true })

export const chatUserSchemas = {
    data: {
        updatePicture: imageDataFieldSchemas.pick({ imageFile: true }),
    },
    params: {
        optIn: ofUser,
        read: ofUser,
        readSpaces: ofUser,
        readDirectMessage: ofUser,
        readPicture: ofUser,
        updatePicture: ofUser,
        destroyPicture: ofUser,
    },
}
