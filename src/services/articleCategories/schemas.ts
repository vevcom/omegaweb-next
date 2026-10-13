import { Zpn } from '@/lib/fields/zpn'
import { visibilityRequirementsSchema } from '@/services/visibility/schemas'
import { z } from 'zod'

/**
 * Both visibility levels are set as the category is created: created with an empty admin level it
 * would be administrable by anyone until someone narrowed it. The regular level may stay empty,
 * which means everyone - whereas a requirement with no conditions at all can never be satisfied,
 * and so means no one but those bypassing with ARTICLE_CATEGORY_ADMIN.
 */
const dataFieldSchemas = z.object({
    name: z.string().trim().min(2, 'Minimum lengde er 2.').max(18, 'Maks lengde er 18.'),
    description: z.string().max(70, 'Maks lengde er 70.'),
    visibilityAdminRequirements: Zpn.json({
        label: 'Hvem kan redigere',
        schema: visibilityRequirementsSchema.min(1, 'Du må velge hvem som kan redigere artiklene i kategorien'),
    }),
    visibilityRegularRequirements: Zpn.json({
        label: 'Hvem kan lese',
        schema: visibilityRequirementsSchema,
    }).default([]),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    articleCategoryId: z.number(),
    name: z.string(),
    articleCategoryName: z.string(),
})

const categoryId = paramsFieldSchemas.pick({
    id: true,
})

const articleCategoryId = paramsFieldSchemas.pick({
    articleCategoryId: true,
})

export const articleCategorySchemas = {
    data: {
        create: dataFieldSchemas.pick({
            name: true,
            description: true,
            visibilityAdminRequirements: true,
            visibilityRegularRequirements: true,
        }),
        update: dataFieldSchemas.pick({
            name: true,
            description: true,
        }).partial(),
    },
    params: {
        visibility: categoryId,
        destroy: categoryId,
        update: categoryId,
        addArticleToCategory: categoryId,
        removeArticleFromCategory: articleCategoryId,
        updateArticle: articleCategoryId,
        read: paramsFieldSchemas.pick({
            name: true,
        }),
        readArticleInCategory: paramsFieldSchemas.pick({
            articleCategoryName: true,
        }),
    },
}
