import { Zpn } from '@/lib/fields/zpn'
import { imageSchemas } from '@/services/images/subservice/schemas'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().min(2, 'min length is 2').max(50, 'max length is 50'),
    color: Zpn.colorInput(),
})

const paramsFieldSchemas = z.object({
    flairId: z.number(),
    userId: z.number(),
})

const flair = dataFieldSchemas.pick({
    name: true,
    color: true,
})

const flairId = paramsFieldSchemas.pick({
    flairId: true,
})

const flairAndUser = paramsFieldSchemas.pick({
    flairId: true,
    userId: true,
})

export const flairSchemas = {
    data: {
        create: flair.merge(imageSchemas.data.uploadImage),
        update: flair.partial(),
        updateImage: imageSchemas.data.uploadImage,
    },
    params: {
        update: flairId,
        updateImage: flairId,
        read: flairId,
        readUserFlairs: paramsFieldSchemas.pick({
            userId: true,
        }),
        assignToUser: flairAndUser,
        unAssignToUser: flairAndUser,
        destroy: flairId,
        increaseRank: flairId,
        decreaseRank: flairId,
    },
}
