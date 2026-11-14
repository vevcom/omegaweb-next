import '@pn-server-only'
import { chatSpaceSchemas } from './schemas'
import { chatSpaceNotificationOperations } from '@/services/chat/spaces/notifications/operations'
import { reserveId } from '@/lib/reserveId'
import { userOperations } from '@/services/users/operations'
import { defineSubOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import type { ChatSpacePurpose } from '@/prisma-generated-pn-types'

const liveSpace = (spaceId: number) => ({ id: spaceId, destroyedAt: null })
const hasChatAccount = { chatUser: { deactivatedAt: null } } as const
const userOverview = { id: true, username: true, firstname: true, lastname: true } as const
const liveRoom = ({ spaceId, roomId }: { spaceId: number, roomId: number }) => ({ id: roomId, spaceId, destroyedAt: null })

/** These only write rows. The chat sync (src/lib/chatSync) makes the homeserver follow. */
export const chatSpaceOperations = {
    create: defineSubOperation({
        dataSchema: () => chatSpaceSchemas.data.create,
        transaction: 'RUNS_IN',
        operation: ({ purpose }: { purpose: ChatSpacePurpose }) => async ({ prisma, data }) => {
            const id = await reserveId(prisma, 'ChatSpace')
            const notificationChannelIds = await chatSpaceNotificationOperations.internal.createChannels.internalCall({
                params: { spaceId: id },
                data: { name: data.name },
            })
            return prisma.chatSpace.create({ data: { id, purpose, name: data.name, ...notificationChannelIds } })
        },
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
                            user: { select: userOverview },
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
        transaction: 'RUNS_IN',
        operation: () => async ({ prisma, params, data }) => {
            const space = await prisma.chatSpace.update({
                where: liveSpace(params.spaceId),
                data: { name: data.name },
            })
            await chatSpaceNotificationOperations.internal.renameChannels.internalCall({
                params: { spaceId: space.id },
                data: { name: space.name },
            })
            return space
        },
    }),

    destroy: defineSubOperation({
        paramsSchema: () => chatSpaceSchemas.params.destroy,
        operation: () => async ({ prisma, params }) => {
            await prisma.chatSpace.update({ where: liveSpace(params.spaceId), data: { destroyedAt: new Date() } })
        },
    }),

    /**
     * A page of those who can be added to a space, as the user list reads its pages: everyone with
     * a chat account, which is whom `addMembers` takes. A former student is among them, whom the
     * user list itself only shows to a user admin.
     */
    readAddableUsers: defineSubOperation({
        paramsSchema: () => chatSpaceSchemas.params.readAddableUsers,
        operation: () => ({ prisma, params }) => userOperations.readPageOf.internalCall({
            prisma,
            params: { paging: params.paging },
            operationImplementationFields: { where: hasChatAccount },
        }),
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
                select: {
                    id: true,
                    name: true,
                    matrixRoomId: true,
                    isPrivate: true,
                    pickedMembers: {
                        select: { spaceMember: { select: { chatUser: { select: { user: { select: userOverview } } } } } },
                        orderBy: { createdAt: 'asc' },
                    },
                },
                orderBy: { id: 'asc' },
            })
            return rooms.map(({ matrixRoomId, pickedMembers, ...room }) => ({
                ...room,
                onHomeserver: matrixRoomId !== null,
                pickedMembers: pickedMembers.flatMap(({ spaceMember }) => spaceMember.chatUser.user ?? []),
            }))
        },
    }),

    createRoom: defineSubOperation({
        paramsSchema: () => chatSpaceSchemas.params.createRoom,
        dataSchema: () => chatSpaceSchemas.data.createRoom,
        operation: () => async ({ prisma, params, data }) => {
            const space = await prisma.chatSpace.findFirst({ where: liveSpace(params.spaceId), select: { id: true } })
            if (!space) throw new ServiceError('NOT FOUND', 'Fant ikke chatområdet')
            return prisma.chatSpaceRoom.create({ data: { spaceId: space.id, name: data.name, isPrivate: data.isPrivate } })
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

    addRoomMembers: defineSubOperation({
        paramsSchema: () => chatSpaceSchemas.params.addRoomMembers,
        dataSchema: () => chatSpaceSchemas.data.addRoomMembers,
        operation: () => async ({ prisma, params, data }) => {
            const room = await prisma.chatSpaceRoom.findFirst({ where: liveRoom(params), select: { isPrivate: true } })
            if (!room) throw new ServiceError('NOT FOUND', 'Fant ikke rommet')
            if (!room.isPrivate) throw new ServiceError('BAD DATA', 'Alle i chatområdet kan gå inn i dette rommet')

            const spaceMembers = await prisma.chatSpaceMember.findMany({
                where: { spaceId: params.spaceId, chatUser: { userId: { in: data.userIds } } },
                select: { id: true },
            })
            if (spaceMembers.length < new Set(data.userIds).size) {
                throw new ServiceError('BAD DATA', 'Bare medlemmer av chatområdet kan legges til i et privat rom')
            }
            await prisma.chatSpaceRoomMember.createMany({
                data: spaceMembers.map(spaceMember => ({ roomId: params.roomId, spaceMemberId: spaceMember.id })),
                skipDuplicates: true,
            })
        },
    }),

    removeRoomMembers: defineSubOperation({
        paramsSchema: () => chatSpaceSchemas.params.removeRoomMembers,
        dataSchema: () => chatSpaceSchemas.data.removeRoomMembers,
        operation: () => async ({ prisma, params, data }) => {
            await prisma.chatSpaceRoomMember.deleteMany({
                where: { room: liveRoom(params), spaceMember: { chatUser: { userId: { in: data.userIds } } } },
            })
        },
    }),
} as const
