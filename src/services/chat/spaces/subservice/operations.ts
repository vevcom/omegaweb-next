import '@pn-server-only'
import { chatSpaceSchemas } from './schemas'
import { defineSubOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import type { ChatSpacePurpose } from '@/prisma-generated-pn-types'

const liveSpace = (spaceId: number) => ({ id: spaceId, destroyedAt: null })
const liveRoom = ({ spaceId, roomId }: { spaceId: number, roomId: number }) => ({ id: roomId, spaceId, destroyedAt: null })

/** These only write rows. The chat sync (src/lib/chatSync) makes the homeserver follow. */
export const chatSpaceOperations = {
    create: defineSubOperation({
        dataSchema: () => chatSpaceSchemas.data.create,
        operation: ({ purpose }: { purpose: ChatSpacePurpose }) =>
            ({ prisma, data }) => prisma.chatSpace.create({ data: { purpose, name: data.name } }),
    }),

    read: defineSubOperation({
        paramsSchema: () => chatSpaceSchemas.params.read,
        operation: () => async ({ prisma, params }) => {
            const space = await prisma.chatSpace.findFirst({ where: liveSpace(params.spaceId) })
            if (!space) throw new ServiceError('NOT FOUND', 'Fant ikke chatområdet')
            return space
        },
    }),

    readMembers: defineSubOperation({
        paramsSchema: () => chatSpaceSchemas.params.readMembers,
        operation: () => async ({ prisma, params }) => {
            const members = await prisma.chatSpaceMember.findMany({
                where: { spaceId: params.spaceId, chatUser: { user: { isNot: null } } },
                select: {
                    chatUser: {
                        select: {
                            syncedName: true,
                            user: { select: { id: true, username: true, firstname: true, lastname: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'asc' },
            })
            return members.map(({ chatUser }) => ({ ...chatUser.user!, onHomeserver: chatUser.syncedName !== null }))
        },
    }),

    update: defineSubOperation({
        paramsSchema: () => chatSpaceSchemas.params.update,
        dataSchema: () => chatSpaceSchemas.data.update,
        operation: () => ({ prisma, params, data }) => prisma.chatSpace.update({
            where: liveSpace(params.spaceId),
            data: { name: data.name },
        }),
    }),

    destroy: defineSubOperation({
        paramsSchema: () => chatSpaceSchemas.params.destroy,
        operation: () => async ({ prisma, params }) => {
            await prisma.chatSpace.update({ where: liveSpace(params.spaceId), data: { destroyedAt: new Date() } })
        },
    }),

    addMembers: defineSubOperation({
        paramsSchema: () => chatSpaceSchemas.params.addMembers,
        dataSchema: () => chatSpaceSchemas.data.addMembers,
        operation: () => async ({ prisma, params, data }) => {
            const chatUsers = await prisma.chatUser.findMany({
                where: { userId: { in: data.userIds }, deactivatedAt: null },
                select: { id: true },
            })
            if (chatUsers.length < new Set(data.userIds).size) {
                throw new ServiceError('BAD DATA', 'Bare de som har logget inn på chatten kan legges til')
            }
            await prisma.chatSpaceMember.createMany({
                data: chatUsers.map(chatUser => ({ spaceId: params.spaceId, chatUserId: chatUser.id })),
                skipDuplicates: true,
            })
        },
    }),

    /** The chat sync puts an admin of the space who is removed back. */
    removeMembers: defineSubOperation({
        paramsSchema: () => chatSpaceSchemas.params.removeMembers,
        dataSchema: () => chatSpaceSchemas.data.removeMembers,
        operation: () => async ({ prisma, params, data }) => {
            await prisma.chatSpaceMember.deleteMany({
                where: { spaceId: params.spaceId, chatUser: { userId: { in: data.userIds } } },
            })
        },
    }),

    readRooms: defineSubOperation({
        paramsSchema: () => chatSpaceSchemas.params.readRooms,
        operation: () => async ({ prisma, params }) => {
            const rooms = await prisma.chatSpaceRoom.findMany({
                where: { spaceId: params.spaceId, destroyedAt: null },
                select: { id: true, name: true, matrixRoomId: true },
                orderBy: { id: 'asc' },
            })
            return rooms.map(({ id, name, matrixRoomId }) => ({ id, name, onHomeserver: matrixRoomId !== null }))
        },
    }),

    createRoom: defineSubOperation({
        paramsSchema: () => chatSpaceSchemas.params.createRoom,
        dataSchema: () => chatSpaceSchemas.data.createRoom,
        operation: () => async ({ prisma, params, data }) => {
            const space = await prisma.chatSpace.findFirst({ where: liveSpace(params.spaceId), select: { id: true } })
            if (!space) throw new ServiceError('NOT FOUND', 'Fant ikke chatområdet')
            return prisma.chatSpaceRoom.create({ data: { spaceId: space.id, name: data.name } })
        },
    }),

    updateRoom: defineSubOperation({
        paramsSchema: () => chatSpaceSchemas.params.updateRoom,
        dataSchema: () => chatSpaceSchemas.data.updateRoom,
        operation: () => ({ prisma, params, data }) => prisma.chatSpaceRoom.update({
            where: liveRoom(params),
            data: { name: data.name },
        }),
    }),

    destroyRoom: defineSubOperation({
        paramsSchema: () => chatSpaceSchemas.params.destroyRoom,
        operation: () => async ({ prisma, params }) => {
            await prisma.chatSpaceRoom.update({ where: liveRoom(params), data: { destroyedAt: new Date() } })
        },
    }),
} as const
