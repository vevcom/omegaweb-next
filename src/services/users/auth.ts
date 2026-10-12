import { Require } from '@/auth/authorizer/Require'

export const profileImagesImagePanelAuth = Require.permission('USERS_ADMIN')

const userFieldOrUsersUse = Require.permission('USERS_USE').or().userField()
const userFieldOrUsersAdmin = Require.permission('USERS_ADMIN').or().userField()
const userIdOrUsersAdmin = Require.permission('USERS_ADMIN').or().userId()

export const userAuth = {
    readProfile: userFieldOrUsersUse,
    readBasic: userFieldOrUsersUse,
    read: userFieldOrUsersAdmin,
    readOrNull: userFieldOrUsersAdmin,
    readUserWithBalance: Require.permission('LEDGER_ADMIN').or().userField(),
    readPage: Require.permission('USERS_USE'),
    search: Require.permission('USERS_USE'),
    create: Require.permission('USERS_ADMIN'),
    connectStudentCard: Require.user(),
    registerNewEmail: userIdOrUsersAdmin,
    updatePassword: userIdOrUsersAdmin,
    update: Require.permission('USERS_ADMIN'),
    updateProfile: userFieldOrUsersAdmin,
    updateProfileImage: userFieldOrUsersAdmin,
    updateBioParagraphContent: userIdOrUsersAdmin,
    register: Require.userId(),
    destroy: Require.permission('USERS_ADMIN'),
} as const
