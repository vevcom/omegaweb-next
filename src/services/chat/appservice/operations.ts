import '@ow-server-only'
import { chatAppserviceAuth } from './auth'
import { chatAppserviceSchemas, roomMessageEventSchema, roomRedactionEventSchema } from './schemas'
import { chatHomeserverToken } from '@/lib/chatSync/constants'
import { defineOperation } from '@/services/serviceOperation'
import type { RoomMessageEvent } from './schemas'

// What is of an earlier event and no message: an edit, a reaction, which some clients encrypt as
// they do a message, and what refers to one, such as the steps of a verification and an answer to a poll.
const OF_EARLIER_MESSAGE: readonly unknown[] = ['m.replace', 'm.annotation', 'm.reference']
const isOfEarlierMessage = ({ content }: RoomMessageEvent) => OF_EARLIER_MESSAGE.includes(content['m.relates_to']?.rel_type)

export const chatAppserviceOperations = {
    /**
     * What the homeserver sends the app as its application service: every event in every room, a
     * few at a time. The messages are kept for the chat worker to notify of, without what they say:
     * those in the rooms of the spaces by their room, and those outside every space, in direct
     * messages and group rooms, by the Matrix room they were written in. One that is removed before
     * it is notified of is forgotten. Everything else is let go. A message of an encrypted room is
     * kept as any other, with whom its client said beside the encrypted part that it mentions.
     * Whether its sender may mention the whole room is for the chat worker to say, as of any message.
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
                .filter(message => !isOfEarlierMessage(message))
            const removedEventIds = data.events.flatMap(event => {
                const removal = roomRedactionEventSchema.safeParse(event)
                return removal.success ? removal.data.redacts ?? removal.data.content?.redacts ?? [] : []
            })

            const matrixRoomIds = messages.map(message => message.room_id)
            const [rooms, spaces] = await Promise.all([
                prisma.chatSpaceRoom.findMany({
                    where: { matrixRoomId: { in: matrixRoomIds } },
                    select: { id: true, matrixRoomId: true, destroyedAt: true, space: { select: { destroyedAt: true } } },
                }),
                prisma.chatSpace.findMany({
                    where: { matrixRoomId: { in: matrixRoomIds } },
                    select: { matrixRoomId: true },
                }),
            ])
            const roomIdOf = new Map(rooms
                .filter(room => room.destroyedAt === null && room.space.destroyedAt === null)
                .map(room => [room.matrixRoomId, room.id]))
            // A room being destroyed is still a space's, and so is the room a space itself is.
            const ofSpaces = new Set([...rooms, ...spaces].map(room => room.matrixRoomId))

            // The homeserver sends a transaction again until it is taken, so a message may come twice.
            await prisma.chatRoomMessage.createMany({
                skipDuplicates: true,
                data: messages.flatMap(message => {
                    const roomId = roomIdOf.get(message.room_id)
                    const isOutsideSpaces = !ofSpaces.has(message.room_id)
                    if (roomId === undefined && !isOutsideSpaces) return []
                    const mentions = message.content['m.mentions']
                    return [{
                        roomId,
                        standaloneMatrixRoomId: isOutsideSpaces ? message.room_id : null,
                        matrixEventId: message.event_id,
                        senderMatrixId: message.sender,
                        mentionedMatrixIds: mentions?.user_ids ?? [],
                        mentionsRoom: mentions?.room ?? false,
                        sentAt: new Date(message.origin_server_ts),
                    }]
                }),
            })
            // After the messages are kept, so one removed in the transaction that brought it goes too.
            await prisma.chatRoomMessage.deleteMany({
                where: { matrixEventId: { in: removedEventIds }, notifiedAt: null },
            })
        },
    }),
} as const
