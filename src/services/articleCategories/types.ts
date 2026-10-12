import type { Article, ArticleCategory } from '@/prisma-generated-pn-types'
import type { DoubleLevelVisibilityMatrix } from '@/services/visibility/types'

export type ExpandedArticleCategory = ArticleCategory & { articles: Article[] }

/**
 * A category as read for its own pages: with both visibility levels, so the client can decide which
 * editing controls to show without reading them separately.
 */
export type ExpandedArticleCategoryWithVisibility = ExpandedArticleCategory & {
    visibility: DoubleLevelVisibilityMatrix
}
