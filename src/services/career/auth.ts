import { Require } from '@/auth/authorizer/Require'

export const careerAuth = {
    readSpecialCmsParagraphCareerInfo: Require.nothing(),
    updateSpecialCmsParagraphContentCareerInfo:
        Require.permission('JOBAD_ADMIN').or().permission('COMMITTEE_ADMIN'),
    readSpecialCmsLink: Require.nothing(),
    updateSpecialCmsLink: Require.permission('JOBAD_ADMIN').or().permission('COMMITTEE_ADMIN')
} as const
