import '@pn-server-only'
import { committeeAuth } from './auth'
import { committeeSchemas } from './schemas'
import { implementChatSpaces } from '@/services/chat/spaces/implement'
import { chatSpaceOperations } from '@/services/chat/spaces/subservice/operations'
import { assertGroupNotPensioned } from '@/services/groups/groupChecks'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'

const implemented = implementChatSpaces({
    purpose: 'COMMITTEE',
    implementationParamsSchema: committeeSchemas.params.chatSpace,
    authorizers: {
        read: ({ implementationParams }) => committeeAuth.readChatSpace.data(implementationParams),
        // The space is named for its committee, so nobody renames it on its own.
        update: () => committeeAuth.update,
        destroy: ({ implementationParams }) => committeeAuth.destroyChatSpace.data(implementationParams),
        setMembers: ({ implementationParams }) => committeeAuth.setChatSpaceMembers.data(implementationParams),
        setRooms: ({ implementationParams }) => committeeAuth.setChatSpaceRooms.data(implementationParams),
    },
    ownershipCheck: async ({ prisma, spaceId, implementationParams }) =>
        (await readLiveChatSpaceId(prisma, implementationParams.groupId)) === spaceId,
})

async function readLiveChatSpaceId(prisma: PrismaPossibleTransaction<false>, groupId: number): Promise<number | null> {
    const committee = await prisma.committee.findUnique({
        where: { groupId },
        select: { chatSpace: { select: { id: true, destroyedAt: true } } },
    })
    const space = committee?.chatSpace
    return space?.destroyedAt === null ? space.id : null
}

const create = defineOperation({
    paramsSchema: committeeSchemas.params.createChatSpace,
    authorizer: ({ params }) => committeeAuth.createChatSpace.data(params),
    transaction: 'OPENS',
    operation: async ({ prisma, params }) => {
        await assertGroupNotPensioned(prisma, params.groupId)

        return prisma.$transaction(async tx => {
            const committee = await tx.committee.findUniqueOrThrow({
                where: { groupId: params.groupId },
                select: { id: true, name: true },
            })
            const space = await implemented.internal.create.internalCall({ prisma: tx, data: { name: committee.name } })
            // One statement, so that two who create at once do not both leave a space behind.
            const { count: committeesGivenTheSpace } = await tx.committee.updateMany({
                where: {
                    id: committee.id,
                    OR: [{ chatSpaceId: null }, { chatSpace: { destroyedAt: { not: null } } }],
                },
                data: { chatSpaceId: space.id },
            })
            if (committeesGivenTheSpace === 0) throw new ServiceError('BAD DATA', 'Komiteen har allerede et chatområde')
            return space
        })
    },
})

type MemberOfCommittee = { id: number, username: string, firstname: string, lastname: string }

export type CommitteeChatSpacePerson = MemberOfCommittee & {
    /** ACTIVE members are in the space by themselves. OUTSIDE is one with no membership in the committee. */
    standing: 'ACTIVE' | 'INACTIVE' | 'OUTSIDE',
    /** The latest order they were a member in. Null for one outside the committee. */
    latestOrder: number | null,
    isInSpace: boolean,
    hasChatAccount: boolean,
}

/** Null when the committee has no space. */
const read = defineOperation({
    paramsSchema: committeeSchemas.params.readChatSpace,
    authorizer: ({ params }) => committeeAuth.readChatSpace.data(params),
    operation: async ({ prisma, params }) => {
        const spaceId = await readLiveChatSpaceId(prisma, params.groupId)
        if (spaceId === null) return null

        const [space, rooms, members, memberships] = await Promise.all([
            chatSpaceOperations.read.internalCall({ prisma, params: { spaceId } }),
            chatSpaceOperations.readRooms.internalCall({ prisma, params: { spaceId } }),
            chatSpaceOperations.readMembers.internalCall({ prisma, params: { spaceId } }),
            prisma.membership.findMany({
                where: { groupId: params.groupId, user: { archived: false } },
                select: {
                    active: true,
                    order: true,
                    user: {
                        select: {
                            id: true,
                            username: true,
                            firstname: true,
                            lastname: true,
                            chatUser: { select: { deactivatedAt: true } },
                        },
                    },
                },
                orderBy: [{ order: 'desc' }, { position: 'asc' }, { userId: 'asc' }],
            }),
        ])

        const userIdsInSpace = new Set(members.map(member => member.id))
        const peopleByUserId = new Map<number, CommitteeChatSpacePerson>()
        for (const { active, order, user: { chatUser, ...user } } of memberships) {
            const earlier = peopleByUserId.get(user.id)
            peopleByUserId.set(user.id, {
                ...user,
                standing: active || earlier?.standing === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
                latestOrder: earlier?.latestOrder ?? order,
                isInSpace: userIdsInSpace.has(user.id),
                hasChatAccount: chatUser !== null && chatUser.deactivatedAt === null,
            })
        }
        const peopleOutsideCommittee = members
            .filter(member => !peopleByUserId.has(member.id))
            .map(({ id, username, firstname, lastname }): CommitteeChatSpacePerson => ({
                id,
                username,
                firstname,
                lastname,
                standing: 'OUTSIDE',
                latestOrder: null,
                isInSpace: true,
                hasChatAccount: true,
            }))

        return {
            space: { id: space.id, name: space.name, onHomeserver: space.matrixRoomId !== null },
            rooms,
            members,
            people: [...Array.from(peopleByUserId.values()), ...peopleOutsideCommittee],
        }
    },
})

/** For the committee's own operations: its space is named for it, and goes when it does. */
export const chatSpaceOfCommittee = {
    rename: async (prisma: PrismaPossibleTransaction<false>, groupId: number, name: string) => {
        const spaceId = await readLiveChatSpaceId(prisma, groupId)
        if (spaceId !== null) await chatSpaceOperations.update.internalCall({ prisma, params: { spaceId }, data: { name } })
    },
    destroy: async (prisma: PrismaPossibleTransaction<false>, groupId: number) => {
        const spaceId = await readLiveChatSpaceId(prisma, groupId)
        if (spaceId !== null) await chatSpaceOperations.destroy.internalCall({ prisma, params: { spaceId } })
    },
}

export const committeeChatSpaceOperations = {
    read,
    create,
    destroy: implemented.destroy,
    readAddableUsers: implemented.readAddableUsers,
    addMembers: implemented.addMembers,
    removeMembers: implemented.removeMembers,
    createRoom: implemented.createRoom,
    updateRoom: implemented.updateRoom,
    destroyRoom: implemented.destroyRoom,
    addRoomMembers: implemented.addRoomMembers,
    removeRoomMembers: implemented.removeRoomMembers,
} as const
