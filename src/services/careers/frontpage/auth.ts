import { Require } from '@/auth/authorizer/Require'

export const careersFrontpageAuth = {
    cmsParagraphs: {
        read: Require.nothing(),
        updateContent: Require.permission('JOBAD_ADMIN').or().permission('COMMITTEE_ADMIN'),
    },
    cmsImages: {
        read: Require.nothing(),
        update: Require.permission('JOBAD_ADMIN').or().permission('COMMITTEE_ADMIN'),
    },
    cmsLinks: {
        read: Require.nothing(),
        update: Require.permission('JOBAD_ADMIN').or().permission('COMMITTEE_ADMIN'),
    },
} as const
