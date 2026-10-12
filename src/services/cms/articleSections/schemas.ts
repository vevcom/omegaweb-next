import { maxImageSize, minImageSize } from './constants'
import { Position } from '@/prisma-generated-pn-types'
import { z } from 'zod'

export const fieldSchemas = z.object({
    id: z.number(),
    name: z.string().min(2).max(100).optional(),
    imageSize: z.number().transform(val => {
        if (val < minImageSize) return minImageSize
        if (val > maxImageSize) return maxImageSize
        return val
    }),
    position: z.nativeEnum(Position),
    part: z.union([z.literal('cmsLink'), z.literal('cmsImage'), z.literal('cmsParagraph')])
})

export const articleSectionSchemas = {
    create: fieldSchemas.pick({
        name: true,
    }),
    update: fieldSchemas.pick({
        imageSize: true,
        position: true
    }).partial(),
    addPart: fieldSchemas.pick({
        part: true
    }),
    removePart: fieldSchemas.pick({
        part: true
    }),
} as const

/** An article section is addressed by its id or by its name. */
const articleSectionAddress = z.union([
    z.object({
        articleSectionId: fieldSchemas.shape.id,
        articleSectionName: z.undefined().optional()
    }),
    z.object({
        articleSectionId: z.undefined().optional(),
        articleSectionName: fieldSchemas.shape.name.unwrap()
    })
])

export const articleSectionParamsSchemas = {
    destroy: articleSectionAddress,
    update: articleSectionAddress,
    addPart: articleSectionAddress,
    removePart: articleSectionAddress,
} as const
