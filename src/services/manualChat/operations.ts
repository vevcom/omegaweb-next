import '@pn-server-only'
import { manualChatSpaceAuth } from './auth'
import { manualChatSpaceSchemas } from './schemas'
import { readManualChatSpaceAdminUserIds } from './roles'
import { implementChatSpaces } from '@/services/chat/spaces/implement'
import { chatSpaceOperations } from '@/services/chat/spaces/subservice/operations'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'

type OfSpace = { prisma: PrismaPossibleTransaction<false>, spaceId: number }

const adminsOf = async (ofSpace: OfSpace) => ({ adminUserIds: await readManualChatSpaceAdminUserIds(ofSpace) })

const implemented = implementChatSpaces({
    purpose: 'MANUAL',
    authorizers: {
        read: async ofSpace => manualChatSpaceAuth.read.data(await adminsOf(ofSpace)),
        update: () => manualChatSpaceAuth.update,
        destroy: () => manualChatSpaceAuth.destroy,
        setMembers: async ofSpace => manualChatSpaceAuth.setMembers.data(await adminsOf(ofSpace)),
        setRooms: async ofSpace => manualChatSpaceAuth.setRooms.data(await adminsOf(ofSpace)),
    },
    // Every space of this purpose is this service's.
    ownershipCheck: () => true,
})

async function assertIsLiveManualSpace(prisma: PrismaPossibleTransaction<false>, spaceId: number) {
    const space = await prisma.chatSpace.findFirst({ where: { id: spaceId, purpose: 'MANUAL', destroyedAt: null } })
    if (!space) throw new ServiceError('NOT FOUND', 'Fant ikke chatområdet')
    return space
}

const userOverview = { id: true, username: true, firstname: true, lastname: true } as const

const create = defineOperation({
    dataSchema: manualChatSpaceSchemas.data.create,
    authorizer: () => manualChatSpaceAuth.create,
    operation: ({ prisma, data }) => implemented.internal.create.internalCall({ prisma, data }),
})

const readAll = defineOperation({
    authorizer: () => manualChatSpaceAuth.readAll,
    operation: async ({ prisma }) => {
        const spaces = await prisma.chatSpace.findMany({
            where: { purpose: 'MANUAL', destroyedAt: null },
            select: {
                id: true,
                name: true,
                manualAdmins: { select: { user: { select: userOverview } }, orderBy: { createdAt: 'asc' } },
                _count: { select: { members: true } },
            },
            orderBy: { name: 'asc' },
        })
        return spaces.map(({ manualAdmins, _count, ...space }) => ({
            ...space,
            admins: manualAdmins.map(admin => admin.user),
            memberCount: _count.members,
        }))
    },
})

const read = defineOperation({
    paramsSchema: manualChatSpaceSchemas.params.read,
    authorizer: async ({ prisma, params }) => manualChatSpaceAuth.read.data(await adminsOf({ prisma, ...params })),
    operation: async ({ prisma, params }) => {
        const space = await assertIsLiveManualSpace(prisma, params.spaceId)
        const [rooms, members, admins] = await Promise.all([
            chatSpaceOperations.readRooms.internalCall({ prisma, params }),
            chatSpaceOperations.readMembers.internalCall({ prisma, params }),
            prisma.manualChatSpaceAdmin.findMany({
                where: { spaceId: params.spaceId },
                select: { user: { select: userOverview } },
                orderBy: { createdAt: 'asc' },
            }),
        ])
        return {
            space: { id: space.id, name: space.name, onHomeserver: space.matrixRoomId !== null },
            rooms,
            members,
            admins: admins.map(admin => admin.user),
        }
    },
})

/** The spaces a user is an admin of. */
const readAdministered = defineOperation({
    paramsSchema: manualChatSpaceSchemas.params.readAdministered,
    authorizer: ({ params }) => manualChatSpaceAuth.readAdministered.data(params),
    operation: ({ prisma, params }) => prisma.chatSpace.findMany({
        where: { purpose: 'MANUAL', destroyedAt: null, manualAdmins: { some: { userId: params.userId } } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
    }),
})

const addAdmins = defineOperation({
    paramsSchema: manualChatSpaceSchemas.params.addAdmins,
    dataSchema: manualChatSpaceSchemas.data.addAdmins,
    authorizer: () => manualChatSpaceAuth.addAdmins,
    operation: async ({ prisma, params, data }) => {
        await assertIsLiveManualSpace(prisma, params.spaceId)
        await prisma.manualChatSpaceAdmin.createMany({
            data: data.userIds.map(userId => ({ spaceId: params.spaceId, userId })),
            skipDuplicates: true,
        })
    },
})

/** One who is an admin no longer stays a member of the space, until they are removed. */
const removeAdmins = defineOperation({
    paramsSchema: manualChatSpaceSchemas.params.removeAdmins,
    dataSchema: manualChatSpaceSchemas.data.removeAdmins,
    authorizer: () => manualChatSpaceAuth.removeAdmins,
    operation: async ({ prisma, params, data }) => {
        await prisma.manualChatSpaceAdmin.deleteMany({
            where: { spaceId: params.spaceId, userId: { in: data.userIds } },
        })
    },
})

export const manualChatSpaceOperations = {
    create,
    readAll,
    read,
    readAdministered,
    addAdmins,
    removeAdmins,
    update: implemented.update,
    destroy: implemented.destroy,
    addMembers: implemented.addMembers,
    removeMembers: implemented.removeMembers,
    createRoom: implemented.createRoom,
    updateRoom: implemented.updateRoom,
    destroyRoom: implemented.destroyRoom,
    addRoomMembers: implemented.addRoomMembers,
    removeRoomMembers: implemented.removeRoomMembers,
} as const
