import type { Prisma } from '@/prisma-generated-pn-types'

/**
 * A visibility that guards nothing, so no model owns it. One made for a notification's audience is
 * such a visibility, and is removed by whoever removes the notification.
 */
export const visibilityOwnedByNothing = {
    imageCollectionAdmin: null,
    imageCollectionRead: null,
    newsArticleAdmin: null,
    newsArticleRead: null,
    eventAdmin: null,
    eventQuota: null,
    articleCategoryAdmin: null,
    articleCategoryRegular: null,
    shopAdmin: null,
    shopRegular: null,
    mailAliasOwner: null,
    mailingListOwner: null,
} as const satisfies Prisma.VisibilityWhereInput
