import '@pn-server-only'
import { cabinArticleAuth } from './auth'
import { implementSpecialArticle } from '@/cms/articles/implement'

export const cabinArticleOperations = implementSpecialArticle({
    special: 'CABIN_PAGE',
    authorizers: cabinArticleAuth,
})
