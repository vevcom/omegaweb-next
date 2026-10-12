import { Require } from '@/auth/authorizer/Require'

/**
 * An article category's admin level decides who may edit, add and remove its articles and change the
 * category itself, its regular level who may see the category and read its articles.
 * ARTICLE_CATEGORY_ADMIN bypasses both levels for every category, and is the only way to create or
 * destroy one - destroying takes every article in it along.
 * Both levels still need `{ visibility: DoubleLevelVisibilityMatrix }` supplied via `.data()`.
 */
const regularLevel = Require.permission('ARTICLE_CATEGORY_ADMIN').or().levelOfDoubleVisibility({ level: 'regularLevel' })
const adminLevel = Require.permission('ARTICLE_CATEGORY_ADMIN').or().levelOfDoubleVisibility({ level: 'adminLevel' })

export const articleCategoryAuth = {
    create: Require.permission('ARTICLE_CATEGORY_ADMIN'),
    destroy: Require.permission('ARTICLE_CATEGORY_ADMIN'),

    readDoubleLevelMatrix: regularLevel,
    updateRegularLevel: adminLevel,
    updateAdminLevel: adminLevel,

    update: adminLevel,
    updateArticle: adminLevel,
    removeArticleFromCategory: adminLevel,
    addArticleToCategory: adminLevel,

    readAll: Require.visibilityFilter({ bypassPermission: 'ARTICLE_CATEGORY_ADMIN' }),
    read: regularLevel,
    readArticleInCategory: regularLevel,
} as const
