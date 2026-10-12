import '@pn-server-only'
import { newStudentAuth } from './auth'
import { implementSpecialArticle } from '@/cms/articles/implement'

export const newStudentOperations = implementSpecialArticle({
    special: 'NEW_STUDENT_PAGE',
    readAuthorizer: newStudentAuth.read,
    updateAuthorizer: newStudentAuth.update,
})
