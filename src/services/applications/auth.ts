import { Require } from '@/auth/authorizer/Require'

const userIdOrApplicationAdmin = Require.permission('APPLICATION_ADMIN').or().userId()
// Applying is for those who may take part in application periods at all, not for any logged-in user.
const applicantOrApplicationAdmin = Require.permission('APPLICATION_ADMIN').or().userId().permission('APPLICATION_USE')

export const applicationAuth = {
    readForUser: userIdOrApplicationAdmin,
    create: applicantOrApplicationAdmin,
    update: applicantOrApplicationAdmin,
    destroy: applicantOrApplicationAdmin,
} as const
