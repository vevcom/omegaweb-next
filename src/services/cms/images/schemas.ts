import { SpecialCmsImage } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().max(200, 'Maks lengde er 200 tegn.').optional(),
    imageId: z.number().optional(),
})

const paramsFieldSchemas = z.object({
    cmsImageId: z.number(),
    special: z.nativeEnum(SpecialCmsImage),
})

const special = paramsFieldSchemas.pick({
    special: true,
})

const cmsImageId = paramsFieldSchemas.pick({
    cmsImageId: true,
})

export const cmsImageSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            name: true,
            imageId: true,
        }),
        update: dataFieldSchemas.pick({
            name: true,
            imageId: true,
        }).partial(),
    },
    params: {
        generateSpecialCmsImageFromConfig: special,
        readSpecial: special,
        update: cmsImageId,
        destroy: cmsImageId,
        isSpecial: z.object({
            cmsImageId: paramsFieldSchemas.shape.cmsImageId,
            special: z.array(paramsFieldSchemas.shape.special),
        }),
    },
}
