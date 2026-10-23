import { Require } from '@/auth/authorizer/Require'

export const careersFrontpageAuth = {
    readSpecialCmsParagraph: Require.nothing(),
    updateSpecialCmsParagraphContent: Require.permission('JOBAD_ADMIN').or().permission('COMMITTEE_ADMIN'),
    readSpecialCmsImage: Require.nothing(),
    updateSpecialCmsImage: Require.permission('JOBAD_ADMIN').or().permission('COMMITTEE_ADMIN'),
    readSpecialCmsLink: Require.nothing(),
    updateSpecialCmsLink: Require.permission('JOBAD_ADMIN').or().permission('COMMITTEE_ADMIN'),
} as const
