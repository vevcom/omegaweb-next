import '@pn-server-only'
import { chatAppserviceAuth } from './auth'
import { chatAppserviceSchemas, roomMessageEventSchema } from './schemas'
import { chatHomeserverToken } from '@/lib/chatSync/constants'
import { defineOperation } from '@/services/serviceOperation'
import type { RoomMessageEvent } from './schemas'

const isEditOfEarlierMessage = (message: RoomMessageEvent) => message.content['m.relates_to']?.rel_type === 'm.replace'

export const chatAppserviceOperations = {
    /**
     * What the homeserver sends the app as its application service: every event in every room, a
     * few at a time. The messages in the rooms of the spaces are kept for the chat worker to notify
     * of, without what they say. Everything else is let go, direct messages among it.
     */
    receiveTransaction: defineOperation({
        paramsSchema: chatAppserviceSchemas.params.receiveTransaction,
        dataSchema: chatAppserviceSchemas.data.receiveTransaction,
        authorizer: ({ params }) => chatAppserviceAuth.receiveTransaction.data({
            provided: params.homeserverToken,
            expected: chatHomeserverToken,
        }),
        operation: async ({ prisma, data }) => {
            const messages = data.events
                .flatMap(event => {
                    const message = roomMessageEventSchema.safeParse(event)
                    return message.success ? [message.data] : []
                })
                .filter(message => !isEditOfEarlierMessage(message))
            if (messages.length === 0) return

            const rooms = await prisma.chatSpaceRoom.findMany({
                where: {
                    matrixRoomId: { in: messages.map(message => message.room_id) },
                    destroyedAt: null,
                    space: { destroyedAt: null },
                },
                select: { id: true, matrixRoomId: true },
            })
            const roomIdOf = new Map(rooms.map(room => [room.matrixRoomId, room.id]))

            // The homeserver sends a transaction again until it is taken, so a message may come twice.
            await prisma.chatRoomMessage.createMany({
                skipDuplicates: true,
                data: messages.flatMap(message => {
                    const roomId = roomIdOf.get(message.room_id)
                    if (roomId === undefined) return []
                    const mentions = message.content['m.mentions']
                    return [{
                        roomId,
                        matrixEventId: message.event_id,
                        senderMatrixId: message.sender,
                        mentionedMatrixIds: mentions?.user_ids ?? [],
                        mentionsRoom: mentions?.room ?? false,
                        sentAt: new Date(message.origin_server_ts),
                    }]
                }),
            })
        },
    }),
} as const
