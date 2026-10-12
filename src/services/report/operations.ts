import '@pn-server-only'
import { reportAuth } from './auth'
import { implementSpecialArticle } from '@/cms/articles/implement'

export const reportOperations = implementSpecialArticle({
    special: 'REPORT_PAGE',
    readAuthorizer: reportAuth.read,
    updateAuthorizer: reportAuth.update,
})
