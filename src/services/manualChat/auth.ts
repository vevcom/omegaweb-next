import { Require } from '@/auth/authorizer/Require'

const manualChatSpaceAdmin = Require.permission('MANUAL_CHAT_SPACE_ADMIN')

const adminOfTheSpace = manualChatSpaceAdmin.or().custom<{ adminUserIds: number[] }>(
    ({ session, adminUserIds }) => session.user !== null && adminUserIds.includes(session.user.id),
    { errorMessage: 'Du må styre chatområdet for å få tilgang' },
)

export const manualChatSpaceAuth = {
    create: manualChatSpaceAdmin,
    readAll: manualChatSpaceAdmin,
    update: manualChatSpaceAdmin,
    destroy: manualChatSpaceAdmin,
    addAdmins: manualChatSpaceAdmin,
    removeAdmins: manualChatSpaceAdmin,
    read: adminOfTheSpace,
    setMembers: adminOfTheSpace,
    setRooms: adminOfTheSpace,
    readAdministered: Require.userId({ errorMessage: 'Bare du selv ser chatområdene du styrer' }),
} as const
