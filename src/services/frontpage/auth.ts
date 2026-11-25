import { Require } from '@/auth/authorizer/Require'

export const frontpageAuth = {
    cmsParagraphs: {
        read: Require.nothing(),
        updateContent: Require.permission('FRONTPAGE_ADMIN'),
    },
    cmsImages: {
        read: Require.nothing(),
        update: Require.permission('FRONTPAGE_ADMIN'),
    },
    cmsLinks: {
        read: Require.nothing(),
        update: Require.permission('FRONTPAGE_ADMIN'),
    },
} as const
