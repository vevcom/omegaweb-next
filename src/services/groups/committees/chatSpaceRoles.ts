import '@pn-server-only'
import type { ReadUserIdsOfChatSpace } from '@/services/chat/spaces/admins'

const userIdsOfActiveMemberships = (which: { admin?: true }): ReadUserIdsOfChatSpace =>
    async ({ prisma, spaceId }) => {
        const memberships = await prisma.membership.findMany({
            where: { ...which, active: true, group: { committee: { chatSpaceId: spaceId } } },
            select: { userId: true },
        })
        return memberships.map(membership => membership.userId)
    }

export const readActiveCommitteeMemberUserIds = userIdsOfActiveMemberships({})
export const readActiveCommitteeAdminUserIds = userIdsOfActiveMemberships({ admin: true })
