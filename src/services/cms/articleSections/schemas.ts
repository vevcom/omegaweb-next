import { maxImageSize, minImageSize } from './constants'
import { Position } from '@/prisma-generated-pn-types'
import { z } from 'zod'

export const articleSectionDataFieldSchemas = z.object({
    name: z.string().min(2).max(100).optional(),
    imageSize: z.number().transform(val => {
        if (val < minImageSize) return minImageSize
        if (val > maxImageSize) return maxImageSize
        return val
    }),
    position: z.nativeEnum(Position),
    part: z.union([z.literal('cmsLink'), z.literal('cmsImage'), z.literal('cmsParagraph')])
})

const paramsFieldSchemas = z.object({
    articleSectionId: z.number(),
    articleSectionName: z.string(),
})

/** An article section is addressed by its id or by its name. */
const articleSectionAddress = z.union([
    z.object({
        articleSectionId: paramsFieldSchemas.shape.articleSectionId,
        articleSectionName: z.undefined().optional()
    }),
    z.object({
        articleSectionId: z.undefined().optional(),
        articleSectionName: paramsFieldSchemas.shape.articleSectionName
    })
])

const part = articleSectionDataFieldSchemas.pick({
    part: true
})

export const articleSectionSchemas = {
    data: {
        create: articleSectionDataFieldSchemas.pick({
            name: true,
        }),
        update: articleSectionDataFieldSchemas.pick({
            imageSize: true,
            position: true
        }).partial(),
        addPart: part,
        removePart: part,
    },
    params: {
        destroy: articleSectionAddress,
        update: articleSectionAddress,
        addPart: articleSectionAddress,
        removePart: articleSectionAddress,
    },
}
