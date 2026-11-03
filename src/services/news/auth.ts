import { Require } from '@/auth/authorizer/Require'
import { doubleLevelVisibilityFilter } from '@/auth/visibility/visibilityFilter'
import type { Prisma } from '@/prisma-generated-pn-types'

/**
 * A news article's admin level decides who may edit, destroy, (un)publish or see it in draft, its
 * regular level who may see it once published. NEWS_ADMIN bypasses both levels for every article.
 * Both still need `{ visibility: DoubleLevelVisibilityMatrix }` supplied via `.data()`.
 */
const regularLevel = Require.permission('NEWS_ADMIN').or().levelOfDoubleVisibility({ level: 'REGULAR' })
const adminLevel = Require.permission('NEWS_ADMIN').or().levelOfDoubleVisibility({ level: 'ADMIN' })

/**
 * Passes when the article's `published` flag, supplied via `.data()`, is `expected`. It fails
 * without a message of its own: it only picks which of the two levels applies, and the message
 * of the level that was checked is the one worth reporting.
 */
const isPublished = (expected: boolean) => Require.custom<{ published: boolean }>(
    ({ published }) => (published === expected ? { success: true } : { success: false })
)

/** The same rule as `read`, as a filter over a list of articles. NEWS_ADMIN lists them unfiltered. */
const visibleNews = Require.permission('NEWS_ADMIN').or().filter(({ session }): Prisma.NewsArticleWhereInput => ({
    OR: [
        { published: true, ...doubleLevelVisibilityFilter(session.memberships, 'REGULAR') },
        { published: false, ...doubleLevelVisibilityFilter(session.memberships, 'ADMIN') },
    ],
}))

export const newsAuth = {
    create: Require.permission('NEWS_ADMIN').or().permission('NEWS_CREATE'),

    readDoubleLevelMatrix: regularLevel,
    updateRegularLevel: adminLevel,
    updateAdminLevel: adminLevel,

    destroy: adminLevel,
    update: adminLevel,
    updateArticle: adminLevel,
    setPublished: adminLevel,

    // Published articles are visible at the regular level, drafts only at the admin level.
    read: Require.anyOf(
        isPublished(true).allOf(regularLevel),
        isPublished(false).allOf(adminLevel),
    ),
    readCurrent: visibleNews,
    readOldPage: visibleNews,
} as const
