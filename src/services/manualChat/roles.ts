import '@pn-server-only'
import type { ReadUserIdsOfChatSpace } from '@/services/chat/spaces/admins'

export const readManualChatSpaceAdminUserIds: ReadUserIdsOfChatSpace = async ({ prisma, spaceId }) => {
    const admins = await prisma.manualChatSpaceAdmin.findMany({ where: { spaceId }, select: { userId: true } })
    return admins.map(admin => admin.userId)
}
