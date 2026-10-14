import { StandardImage } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const paramsFieldSchemas = z.object({
    standardImage: z.nativeEnum(StandardImage),
})

const standardImage = paramsFieldSchemas.pick({
    standardImage: true,
})

export const standardImageCollectionSchemas = {
    params: {
        generateStandardImageFromConfig: standardImage,
        updateStandardImageFromConfig: standardImage,
        readStandardImage: standardImage,
    },
}
