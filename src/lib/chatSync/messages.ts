import '@ow-server-only'
import { chatSpaceNotificationOperations } from '@/services/chat/spaces/notifications/operations'
import { chatDirectAndGroupNotificationChannel } from '@/services/chat/directAndGroupNotificationChannel'
import { chatLinks } from '@/app/(omegaweb)/chat/links'
import { prisma } from '@/prisma-pn-client-instance'
import type { ChatPowerLevels, Homeserver } from './client'
import type { SyncReport } from './report'
import type { Prisma } from '@/prisma-generated-pn-types'

const MESSAGES_PER_RUN = 200
/**
 * A message is notified of soon or not at all. One that could not be for this long is let go, so
 * it does not stand first in every run, and so is what piled up while the homeserver or the worker
 * was away, which nobody wants to hear of hours later.
 */
const NOTIFIED_OF_WITHIN_MS = 60 * 60 * 1000
/** What a room says it takes to mention everyone in it, when it says nothing: Matrix's default. */
const DEFAULT_LEVEL_TO_MENTION_ROOM = 50
/** The homeserver may tell of a message again for as long as it has not been answered, and then it is known. */
const KEPT_AFTER_NOTIFIED_MS = 24 * 60 * 60 * 1000

const withRoomAndSpace = {
    room: {
        select: {
            name: true,
            matrixRoomId: true,
            space: { select: { name: true, mentionsNotificationChannelId: true, allNotificationChannelId: true } },
        },
    },
} satisfies Prisma.ChatRoomMessageInclude

type KeptMessage = Prisma.ChatRoomMessageGetPayload<{ include: typeof withRoomAndSpace }>
type MessageInSpace = KeptMessage & { room: NonNullable<KeptMessage['room']> }
type StandaloneMessage = KeptMessage & { standaloneMatrixRoomId: string }

type RoomAsItIs = {
    /** Without the bot. */
    inRoom: string[],
    levels: ChatPowerLevels,
}
const roomNobodyIsIn: RoomAsItIs = { inRoom: [], levels: {} }

/**
 * Makes a notification of every message the homeserver has told of, see
 * src/services/chat/appservice. In a room of a space, one that mentions someone goes in the
 * space's channel for mentions, to those mentioned, and any other in its channel for every
 * message, to everyone in the room. A mention of the whole room counts only from one the room lets
 * mention it, as Matrix has it. Outside the spaces, what one user wrote in one room since the last
 * run is one notification, in the channel for direct messages and group rooms, to the others in
 * the room and those invited to it. The one who wrote is never notified, and neither is anyone
 * who is not in the room.
 */
export async function notifyOfMessages(homeserver: Homeserver, report: SyncReport): Promise<void> {
    const tooLongAgo = new Date(Date.now() - NOTIFIED_OF_WITHIN_MS)
    const messages = await prisma.chatRoomMessage.findMany({
        where: { notifiedAt: null, sentAt: { gte: tooLongAgo } },
        include: withRoomAndSpace,
        orderBy: { id: 'asc' },
        take: MESSAGES_PER_RUN,
    })

    const roomsRead = new Map<string, Promise<RoomAsItIs>>()
    const readRoom = (matrixRoomId: string) => {
        const alreadyRead = roomsRead.get(matrixRoomId)
        if (alreadyRead) return alreadyRead
        const reading = homeserver.readRoom(matrixRoomId).then((room): RoomAsItIs => (room ? {
            inRoom: room.joinedUserIds.filter(userId => userId !== homeserver.botUserId),
            levels: room.levels,
        } : roomNobodyIsIn))
        roomsRead.set(matrixRoomId, reading)
        return reading
    }

    for (const message of messages) {
        const { room } = message
        if (room === null) continue
        await report.carryOut({
            what: `notify of the message ${message.matrixEventId}`,
            run: async () => {
                const roomAsItIs = room.matrixRoomId === null ? roomNobodyIsIn : await readRoom(room.matrixRoomId)
                await notifyOf(homeserver, { ...message, room }, roomAsItIs)
            },
        })
    }

    for (const fromOneInOneRoom of bySenderAndRoom(messages)) {
        const [{ standaloneMatrixRoomId, senderMatrixId }] = fromOneInOneRoom
        await report.carryOut({
            what: `notify of what ${senderMatrixId} wrote in ${standaloneMatrixRoomId}`,
            run: () => notifyOfStandalone(homeserver, fromOneInOneRoom),
        })
    }

    await prisma.chatRoomMessage.deleteMany({
        where: {
            OR: [
                { notifiedAt: { lt: new Date(Date.now() - KEPT_AFTER_NOTIFIED_MS) } },
                { notifiedAt: null, sentAt: { lt: tooLongAgo } },
            ],
        },
    })
}

function mayMentionRoom(levels: ChatPowerLevels, matrixId: string): boolean {
    const { notifications, users_default: usersDefault } = levels as {
        notifications?: { room?: number },
        users_default?: number,
    }
    const levelToMentionRoom = notifications?.room ?? DEFAULT_LEVEL_TO_MENTION_ROOM
    return (levels.users?.[matrixId] ?? usersDefault ?? 0) >= levelToMentionRoom
}

async function notifyOf(homeserver: Homeserver, message: MessageInSpace, { inRoom, levels }: RoomAsItIs): Promise<void> {
    const { room } = message
    const othersInRoom = inRoom.filter(matrixId => matrixId !== message.senderMatrixId)
    const mentionsRoom = message.mentionsRoom && mayMentionRoom(levels, message.senderMatrixId)
    const mentionsSomeone = mentionsRoom || message.mentionedMatrixIds.length > 0
    const mentioned = mentionsRoom
        ? othersInRoom
        : othersInRoom.filter(matrixId => message.mentionedMatrixIds.includes(matrixId))
    const recipients = mentionsSomeone ? mentioned : othersInRoom

    const [recipientUserIds, sender] = await Promise.all([
        readUserIds(homeserver, recipients),
        readNameOf(homeserver, message.senderMatrixId),
    ])
    const wrote = mentionsRoom ? 'nevnte alle' : 'nevnte deg'
    const notification = {
        title: `${sender} ${mentionsSomeone ? wrote : 'skrev'} i ${room.name}`,
        message: `Meldingen ligger i rommet ${room.name} i chatområdet ${room.space.name}.`,
        url: chatLinks.spaces(),
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

/** The messages written outside every space, those of one user in one room together. */
function bySenderAndRoom(messages: KeptMessage[]): [StandaloneMessage, ...StandaloneMessage[]][] {
    const together = new Map<string, [StandaloneMessage, ...StandaloneMessage[]]>()
    for (const message of messages) {
        const { standaloneMatrixRoomId } = message
        if (standaloneMatrixRoomId === null) continue
        const key = `${standaloneMatrixRoomId} ${message.senderMatrixId}`
        const standalone = { ...message, standaloneMatrixRoomId }
        const earlier = together.get(key)
        if (earlier) earlier.push(standalone)
        else together.set(key, [standalone])
    }
    return Array.from(together.values())
}

async function notifyOfStandalone(
    homeserver: Homeserver,
    messages: [StandaloneMessage, ...StandaloneMessage[]],
): Promise<void> {
    const [{ standaloneMatrixRoomId, senderMatrixId }] = messages
    const room = await homeserver.readStandaloneRoom(standaloneMatrixRoomId)
    // One who is written to for the first time is invited to the room, and not in it yet.
    const others = [...room?.joinedUserIds ?? [], ...room?.invitedUserIds ?? []]
        .filter(matrixId => matrixId !== senderMatrixId)
    const isDirectMessage = room?.name === undefined && others.length === 1

    const [recipientUserIds, sender] = await Promise.all([
        readUserIds(homeserver, others),
        readNameOf(homeserver, senderMatrixId),
    ])
    const notification = isDirectMessage ? {
        title: `${sender} skrev til deg`,
        message: 'Meldingen ligger i direktemeldingene dine på chatten.',
    } : {
        title: `${sender} skrev i ${room?.name ?? 'en gruppe'}`,
        message: 'Meldingen ligger i en gruppe du er med i på chatten.',
    }

    await prisma.$transaction(async tx => {
        // No users would mean everyone subscribed, so nothing is made for nobody.
        if (recipientUserIds.length > 0) {
            await chatDirectAndGroupNotificationChannel.internal.createNotification.internalCall({
                prisma: tx,
                data: { ...notification, url: chatLinks.messages(), audience: { userIds: recipientUserIds } },
            })
        }
        await tx.chatRoomMessage.updateMany({
            where: { id: { in: messages.map(message => message.id) } },
            data: { notifiedAt: new Date() },
        })
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
