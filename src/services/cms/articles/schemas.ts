import { fieldSchemas as articleSectionFieldSchemas } from '@/cms/articleSections/schemas'
import { SpecialCmsArticle } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const name = (maxLength: number) => z.string()
    .min(2, 'Minimum lengde er 2 tegn.')
    .max(maxLength, `Maksimum lengde er ${maxLength} tegn.`)

const fieldSchemas = z.object({
    id: z.number(),
    special: z.nativeEnum(SpecialCmsArticle),
    name: name(30),
    includeParts: z.record(articleSectionFieldSchemas.shape.part, z.boolean()),
    direction: z.union([z.literal('UP'), z.literal('DOWN')])
})

export const articleSchemas = {
    /** The owner sets how long a name may be - a category article has less room than news. */
    create: ({ maxNameLength }: { maxNameLength: number }) => z.object({
        name: name(maxNameLength).optional(),
    }),
    update: fieldSchemas.pick({
        name: true,
    }).partial(),
    addSection: fieldSchemas.pick({
        includeParts: true
    }),
    reorderSections: fieldSchemas.pick({
        direction: true
    }),
} as const

const articleId = z.object({
    articleId: fieldSchemas.shape.id,
})

const special = fieldSchemas.pick({
    special: true,
})

export const articleParamsSchemas = {
    generateSpecialArticleFromConfig: special,
    readSpecial: special,
    destroy: articleId,
    update: articleId,
    addSection: articleId,
    reorderSections: articleId.extend({
        sectionId: articleSectionFieldSchemas.shape.id,
    }),
    read: articleId,
} as const
