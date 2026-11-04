import '@pn-server-only'
import { revueFrontpageAuth } from './auth'
import { implementSpecialArticle } from '@/cms/articles/implement'

export const revueFrontpageOperations = {
    mainRevueInfo: implementSpecialArticle({
        special: 'MAIN_REVUE_INFO',
        readAuthorizer: revueFrontpageAuth.readMainRevueInfo,
        updateAuthorizer: revueFrontpageAuth.updateMainRevueInfo,
    }),
} as const
