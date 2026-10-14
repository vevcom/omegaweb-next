import { Require } from '@/auth/authorizer/Require'

export const careerAuth = {
    readSpecialCmsParagraph: Require.nothing(),
    updateSpecialCmsParagraphContent: Require.permission('JOBAD_ADMIN').or().permission('COMMITTEE_ADMIN'),
    readSpecialCmsImage: Require.nothing(),
    updateSpecialCmsImage: Require.permission('JOBAD_ADMIN').or().permission('COMMITTEE_ADMIN'),
} as const
