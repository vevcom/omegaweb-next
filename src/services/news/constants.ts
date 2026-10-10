import { articleRelationsIncluder } from '@/cms/articles/constants'
import { expandedImageIncluder } from '@/services/images/subservice/constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export const defaultNewsArticleOldCutoff = 7 // by default a newsarticle is considered old after 7 days

export const newsArticleRealtionsIncluder = {
    article: {
        include: articleRelationsIncluder
    }
} as const satisfies Prisma.NewsArticleInclude

export const simpleNewsArticleRealtionsIncluder = {
    article: {
        include: {
            coverImage: {
                include: {
                    image: { include: expandedImageIncluder }
                }
            }
        }
    }
} as const satisfies Prisma.NewsArticleInclude
