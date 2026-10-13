import { articleSectionDataFieldSchemas } from '@/cms/articleSections/schemas'
import { SpecialCmsArticle } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const name = (maxLength: number) => z.string()
    .min(2, 'Minimum lengde er 2 tegn.')
    .max(maxLength, `Maksimum lengde er ${maxLength} tegn.`)

const dataFieldSchemas = z.object({
    name: name(30),
    includeParts: z.record(articleSectionDataFieldSchemas.shape.part, z.boolean()),
    direction: z.union([z.literal('UP'), z.literal('DOWN')])
})

const paramsFieldSchemas = z.object({
    articleId: z.number(),
    sectionId: z.number(),
    special: z.nativeEnum(SpecialCmsArticle),
})

const articleId = paramsFieldSchemas.pick({
    articleId: true,
})

const special = paramsFieldSchemas.pick({
    special: true,
})

export const articleSchemas = {
    data: {
        /** The owner sets how long a name may be - a category article has less room than news. */
        create: ({ maxNameLength }: { maxNameLength: number }) => z.object({
            name: name(maxNameLength).optional(),
        }),
        update: dataFieldSchemas.pick({
            name: true,
        }).partial(),
        addSection: dataFieldSchemas.pick({
            includeParts: true
        }),
        reorderSections: dataFieldSchemas.pick({
            direction: true
        }),
    },
    params: {
        generateSpecialArticleFromConfig: special,
        readSpecial: special,
        destroy: articleId,
        update: articleId,
        addSection: articleId,
        reorderSections: paramsFieldSchemas.pick({
            articleId: true,
            sectionId: true,
        }),
        read: articleId,
    },
}
