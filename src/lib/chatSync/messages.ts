import '@pn-server-only'
import { chatSpaceNotificationOperations } from '@/services/chat/spaces/notifications/operations'
import { prisma } from '@/prisma-pn-client-instance'
import type { Homeserver } from './client'
import type { SyncReport } from './report'
import type { Prisma } from '@/prisma-generated-pn-types'

const MESSAGES_PER_RUN = 200
/** The homeserver may tell of a message again for as long as it has not been answered, and then it is known. */
const KEPT_AFTER_NOTIFIED_MS = 24 * 60 * 60 * 1000
/** Where a notification leads: the user's own chat page, since a notification only links within the site. */
const CHAT_PAGE_OF_THE_USER = '/users/me/chat'

const withRoomAndSpace = {
    room: {
        select: {
            name: true,
            matrixRoomId: true,
            space: { select: { name: true, mentionsNotificationChannelId: true, allNotificationChannelId: true } },
        },
    },
} satisfies Prisma.ChatRoomMessageInclude

type MessageToNotifyOf = Prisma.ChatRoomMessageGetPayload<{ include: typeof withRoomAndSpace }>

/**
 * Makes a notification of every message the homeserver has told of, see
 * src/services/chat/appservice: one that mentions someone in the space's channel for mentions, to
 * those mentioned, and any other in its channel for every message, to everyone in the room. The
 * one who wrote is never notified, and neither is anyone who is not in the room.
 */
export async function notifyOfMessages(homeserver: Homeserver, report: SyncReport): Promise<void> {
    const messages = await prisma.chatRoomMessage.findMany({
        where: { notifiedAt: null },
        include: withRoomAndSpace,
        orderBy: { id: 'asc' },
        take: MESSAGES_PER_RUN,
    })

    const othersInRoomByMatrixRoomId = new Map<string, Promise<string[]>>()
    const readThoseInRoom = (matrixRoomId: string) => {
        const alreadyRead = othersInRoomByMatrixRoomId.get(matrixRoomId)
        if (alreadyRead) return alreadyRead
        const reading = homeserver.readRoom(matrixRoomId).then(
            room => (room?.joinedUserIds ?? []).filter(userId => userId !== homeserver.botUserId)
        )
        othersInRoomByMatrixRoomId.set(matrixRoomId, reading)
        return reading
    }

    for (const message of messages) {
        await report.carryOut({
            what: `notify of the message ${message.matrixEventId}`,
            run: async () => {
                const inRoom = message.room.matrixRoomId === null ? [] : await readThoseInRoom(message.room.matrixRoomId)
                await notifyOf(homeserver, message, inRoom)
            },
        })
    }

    await prisma.chatRoomMessage.deleteMany({
        where: { notifiedAt: { lt: new Date(Date.now() - KEPT_AFTER_NOTIFIED_MS) } },
    })
}

async function notifyOf(homeserver: Homeserver, message: MessageToNotifyOf, inRoom: string[]): Promise<void> {
    const { room } = message
    const othersInRoom = inRoom.filter(matrixId => matrixId !== message.senderMatrixId)
    const mentionsSomeone = message.mentionsRoom || message.mentionedMatrixIds.length > 0
    const mentioned = message.mentionsRoom
        ? othersInRoom
        : othersInRoom.filter(matrixId => message.mentionedMatrixIds.includes(matrixId))
    const recipients = mentionsSomeone ? mentioned : othersInRoom

    const [recipientUserIds, sender] = await Promise.all([
        readUserIds(homeserver, recipients),
        readNameOf(homeserver, message.senderMatrixId),
    ])
    const wrote = message.mentionsRoom ? 'nevnte alle' : 'nevnte deg'
    const notification = {
        title: `${sender} ${mentionsSomeone ? wrote : 'skrev'} i ${room.name}`,
        message: `Meldingen ligger i rommet ${room.name} i chatområdet ${room.space.name}.`,
        url: CHAT_PAGE_OF_THE_USER,
        audience: { userIds: recipientUserIds },
    }
    const { createMentionsNotification, createAllNotification } = chatSpaceNotificationOperations.internal

    await prisma.$transaction(async tx => {
        // No users would mean everyone subscribed, so nothing is made for nobody.
        if (recipientUserIds.length > 0 && mentionsSomeone) {
            await createMentionsNotification.internalCall({
                prisma: tx,
                params: { channelId: room.space.mentionsNotificationChannelId },
                data: notification,
            })
        }
        if (recipientUserIds.length > 0 && !mentionsSomeone) {
            await createAllNotification.internalCall({
                prisma: tx,
                params: { channelId: room.space.allNotificationChannelId },
                data: notification,
            })
        }
        await tx.chatRoomMessage.update({ where: { id: message.id }, data: { notifiedAt: new Date() } })
    })
}

/** The localpart of a Matrix id of this homeserver. Null for an id that is another homeserver's. */
function localpartOf(homeserver: Homeserver, matrixId: string): string | null {
    const localpart = matrixId.slice(1).split(':')[0]
    return homeserver.userIdOf(localpart) === matrixId ? localpart : null
}

async function readUserIds(homeserver: Homeserver, matrixIds: string[]): Promise<number[]> {
    const localparts = matrixIds.flatMap(matrixId => localpartOf(homeserver, matrixId) ?? [])
    const chatUsers = await prisma.chatUser.findMany({
        where: { localpart: { in: localparts }, userId: { not: null } },
        select: { userId: true },
    })
    return chatUsers.flatMap(chatUser => chatUser.userId ?? [])
}

async function readNameOf(homeserver: Homeserver, matrixId: string): Promise<string> {
    const localpart = localpartOf(homeserver, matrixId)
    const chatUser = localpart === null ? null : await prisma.chatUser.findUnique({
        where: { localpart },
        select: { user: { select: { firstname: true, lastname: true } } },
    })
    return chatUser?.user ? `${chatUser.user.firstname} ${chatUser.user.lastname}` : 'Noen'
}
