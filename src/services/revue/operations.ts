import '@pn-server-only'
import { revueAuth } from './auth'
import { implementSpecialArticle } from '@/cms/articles/implement'

export const revueOperations = {
    mainRevueInfo: implementSpecialArticle({
        special: 'MAIN_REVUE_INFO',
        readAuthorizer: revueAuth.readMainRevueInfo,
        updateAuthorizer: revueAuth.updateMainRevueInfo,
    }),
} as const
