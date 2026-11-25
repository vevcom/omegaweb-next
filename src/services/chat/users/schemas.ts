import { MAX_CHAT_PROFILES_AT_ONCE } from './constants'
import { imageDataFieldSchemas } from '@/services/images/subservice/schemas'
import { userSchemas } from '@/services/users/schemas'
import { z } from 'zod'

const paramsFieldSchemas = z.object({
    userId: z.number().int(),
    matrixUserIds: z.array(z.string().max(255)).max(MAX_CHAT_PROFILES_AT_ONCE),
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
        readProfiles: paramsFieldSchemas.pick({ matrixUserIds: true }),
        readPage: userSchemas.params.readPage,
        readPicture: ofUser,
        updatePicture: ofUser,
        destroyPicture: ofUser,
    },
}
