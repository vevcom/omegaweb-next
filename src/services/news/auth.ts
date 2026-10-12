import { Require } from '@/auth/authorizer/Require'
import type { DoubleLevelVisibilityMatrix } from '@/services/visibility/types'

/**
 * A news article's admin level decides who may edit, destroy, (un)publish or see it in draft, its
 * regular level who may see it once published. NEWS_ADMIN bypasses both levels for every article.
 * Both still need `{ visibility: DoubleLevelVisibilityMatrix }` supplied via `.data()`.
 */
const regularLevel = Require.permission('NEWS_ADMIN').or().levelOfDoubleVisibility({ level: 'regularLevel' })
const adminLevel = Require.permission('NEWS_ADMIN').or().levelOfDoubleVisibility({ level: 'adminLevel' })

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
    read: ({ published, doubleLevelMatrix }: { published: boolean, doubleLevelMatrix: DoubleLevelVisibilityMatrix }) =>
        (published ? regularLevel : adminLevel).data({ visibility: doubleLevelMatrix }),
    readCurrent: Require.visibilityFilter({ bypassPermission: 'NEWS_ADMIN' }),
    readOldPage: Require.visibilityFilter({ bypassPermission: 'NEWS_ADMIN' }),
} as const
