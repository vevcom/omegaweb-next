import '@ow-server-only'
import { reportAuth } from './auth'
import { implementSpecialArticle } from '@/cms/articles/implement'

export const reportOperations = implementSpecialArticle({
    special: 'REPORT_PAGE',
    authorizers: reportAuth,
})
