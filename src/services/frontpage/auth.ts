import { Require } from '@/auth/authorizer/Require'


export const frontpageAuth = {
    readSpecialCmsParagraphSection: Require.nothing(),
    updateSpecialCmsParagraphContentSection: Require.permission('FRONTPAGE_ADMIN'),
    readSpecialCmsImage: Require.nothing(),
    updateSpecialCmsImage: Require.permission('FRONTPAGE_ADMIN')
} as const
