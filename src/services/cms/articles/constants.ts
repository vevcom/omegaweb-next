import { articleSectionsRelationsIncluder } from '@/cms/articleSections/constants'
import { expandedImageIncluder } from '@/services/images/subservice/constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export const maxSections = 10 // Max 10 sections in an article

export const articleRelationsIncluder = {
    articleSections: {
        include: articleSectionsRelationsIncluder
    },
    coverImage: {
        include: {
            image: { include: expandedImageIncluder }
        },
    },
} as const satisfies Prisma.ArticleInclude
