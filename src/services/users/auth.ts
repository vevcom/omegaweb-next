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
    readUnarchivedPage: Require.permission('USERS_ADMIN'),
    readArchivedPage: Require.permission('USERS_ADMIN'),
    search: Require.permission('USERS_USE'),
    create: Require.permission('USERS_ADMIN'),
    // A card is connected by the user it belongs to, who scanned it themselves.
    connectStudentCard: Require.userId(),
    registerNewEmail: userIdOrUsersAdmin,
    updatePassword: userIdOrUsersAdmin,
    update: Require.permission('USERS_ADMIN'),
    updateProfile: userFieldOrUsersAdmin,
    updateProfileImage: userFieldOrUsersAdmin,
    // The theme is only ever the session user's own, so not even a user admin sets it for someone else.
    updateTheme: Require.userField(),
    updateBioParagraphContent: userIdOrUsersAdmin,
    register: Require.userId(),
    destroy: Require.permission('USERS_ADMIN'),
    // A user may leave on their own. Only an admin may let them back in.
    archive: userIdOrUsersAdmin,
    unarchive: Require.permission('USERS_ADMIN'),
} as const
