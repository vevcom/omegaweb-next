import { SpecialCmsImage } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const fieldSchemas = z.object({
    id: z.number(),
    special: z.nativeEnum(SpecialCmsImage),
    name: z.string().max(200, 'Maks lengde er 200 tegn.').optional(),
    imageId: z.number().optional(),
})

export const cmsImageSchemas = {
    create: fieldSchemas.pick({
        name: true,
        imageId: true,
    }),
    update: fieldSchemas.pick({
        name: true,
        imageId: true,
    }).partial()
} as const

const special = fieldSchemas.pick({
    special: true,
})

const cmsImageId = z.object({
    cmsImageId: fieldSchemas.shape.id,
})

export const cmsImageParamsSchemas = {
    generateSpecialCmsImageFromConfig: special,
    readSpecial: special,
    update: cmsImageId,
    destroy: cmsImageId,
    isSpecial: cmsImageId.extend({
        special: z.array(fieldSchemas.shape.special),
    }),
} as const
