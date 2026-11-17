import { createChatSpace } from 'tests/chatSpaces'
import { FakeHomeserver } from 'tests/fakeHomeserver'
import { syncChat } from '@/lib/chatSync/sync'
import { chatSpaceAdmins } from '@/services/chat/spaces/admins'
import { prisma } from '@/prisma-pn-client-instance'
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'

let homeserver: FakeHomeserver
let sent = 0

beforeEach(() => {
    homeserver = new FakeHomeserver()
})

afterEach(async () => {
    Reflect.deleteProperty(chatSpaceAdmins, 'MANUAL')
    await prisma.notification.deleteMany()
    await prisma.chatSpace.deleteMany()
    await prisma.chatRoomMessage.deleteMany()
    await prisma.chatUser.deleteMany()
    await prisma.user.deleteMany({ where: { email: { endsWith: '@chat-notify.test' } } })
})

async function createChatUser(localpart: string) {
    const user = await prisma.user.create({
        data: {
            username: localpart,
            email: `${localpart}@chat-notify.test`,
            firstname: localpart,
            lastname: 'Nordmann',
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
            chatUser: { create: { localpart } },
        },
        include: { chatUser: true },
    })
    return { id: user.id, chatUserId: user.chatUser!.id, matrixId: homeserver.signIn(localpart) }
}

/** Kari and Ola are in the room. Per is in the space and not in the room. */
async function roomWithKariAndOla() {
    const [kari, ola, per] = await Promise.all(['kari', 'ola', 'per'].map(createChatUser))
    const space = await createChatSpace({ name: 'Vevcom', memberChatUserIds: [kari, ola, per].map(user => user.chatUserId) })
    const room = await prisma.chatSpaceRoom.create({ data: { spaceId: space.id, name: 'Prat' } })
    await syncChat(homeserver)
    const { matrixRoomId } = await prisma.chatSpaceRoom.findUniqueOrThrow({ where: { id: room.id } })
    homeserver.join(matrixRoomId!, kari.matrixId)
    homeserver.join(matrixRoomId!, ola.matrixId)
    return { space, room, kari, ola, per }
}

/** What the homeserver's telling of a message leaves, see tests/api/chatAppservice.test.ts. */
type Mentions = { users?: string[], room?: boolean }

function messageIn(
    room: { id: number },
    sender: { matrixId: string },
    { users = [], room: mentionsRoom = false, minutesAgo = 0 }: Mentions & { minutesAgo?: number } = {},
) {
    return prisma.chatRoomMessage.create({
        data: {
            roomId: room.id,
            matrixEventId: `$message${++sent}`,
            senderMatrixId: sender.matrixId,
            mentionedMatrixIds: users,
            mentionsRoom,
            sentAt: new Date(Date.now() - minutesAgo * 60 * 1000),
        },
    })
}

/**
 * The tests make no notifications, see tests/setup.ts, so that is lifted for the run. IGNORE_SERVER_ONLY
 * stays set, as it is for the worker that runs the sync.
 */
async function syncAndReadNotifications() {
    const notificationsOff = process.env.NOTIFICATIONS_OFF
    Reflect.deleteProperty(process.env, 'NOTIFICATIONS_OFF')
    try {
        await syncChat(homeserver)
    } finally {
        if (notificationsOff !== undefined) process.env.NOTIFICATIONS_OFF = notificationsOff
    }
    const notifications = await prisma.notification.findMany({
        select: { title: true, message: true, url: true, channelId: true, usersTargeted: { select: { id: true } } },
        orderBy: { id: 'asc' },
    })
    return notifications.map(({ usersTargeted, ...notification }) => ({
        ...notification,
        to: usersTargeted.map(user => user.id).sort(),
    }))
}

describe('a message in a room of a space', () => {
    test('is notified of in the channel for every message, to the others in the room', async () => {
        const { space, room, kari, ola } = await roomWithKariAndOla()
        await messageIn(room, kari)

        await expect(syncAndReadNotifications()).resolves.toEqual([{
            title: 'kari Nordmann skrev i Prat',
            message: 'Meldingen ligger i rommet Prat i chatområdet Vevcom.',
            url: '/users/me/chat',
            channelId: space.allNotificationChannelId,
            to: [ola.id],
        }])
    })

    test('that mentions someone is notified of in the channel for mentions, to them alone', async () => {
        const { space, room, kari, ola, per } = await roomWithKariAndOla()
        const guro = await createChatUser('guro')
        const { matrixRoomId } = await prisma.chatSpaceRoom.findUniqueOrThrow({ where: { id: room.id } })
        homeserver.room(matrixRoomId!).members.push(guro.matrixId)
        // Per is mentioned too, and is not in the room.
        await messageIn(room, kari, { users: [ola.matrixId, per.matrixId] })

        await expect(syncAndReadNotifications()).resolves.toEqual([
            expect.objectContaining({
                title: 'kari Nordmann nevnte deg i Prat',
                channelId: space.mentionsNotificationChannelId,
                to: [ola.id],
            }),
        ])
    })

    test('that mentions the room is notified of in the channel for mentions, to everyone else in it', async () => {
        const { space, room, kari, ola } = await roomWithKariAndOla()
        // An admin of the space moderates its rooms, and so may mention a whole room.
        chatSpaceAdmins.MANUAL = () => Promise.resolve([ola.id])
        await messageIn(room, ola, { room: true })

        await expect(syncAndReadNotifications()).resolves.toEqual([
            expect.objectContaining({
                title: 'ola Nordmann nevnte alle i Prat',
                channelId: space.mentionsNotificationChannelId,
                to: [kari.id],
            }),
        ])
    })

    test('that mentions the room is any other message from one who may not mention the room', async () => {
        const { space, room, kari, ola } = await roomWithKariAndOla()
        await messageIn(room, ola, { room: true })

        await expect(syncAndReadNotifications()).resolves.toEqual([
            expect.objectContaining({
                title: 'ola Nordmann skrev i Prat',
                channelId: space.allNotificationChannelId,
                to: [kari.id],
            }),
        ])
    })

    test('is notified of within the hour or not at all, so what piled up is let go', async () => {
        const { room, kari } = await roomWithKariAndOla()
        const recent = await messageIn(room, kari, { minutesAgo: 30 })
        await messageIn(room, kari, { minutesAgo: 90 })

        expect(await syncAndReadNotifications()).toHaveLength(1)
        expect(await prisma.chatRoomMessage.findMany({ select: { id: true } })).toEqual([{ id: recent.id }])
    })

    test('that cannot be notified of is tried again, without keeping those after it waiting', async () => {
        const { room, kari } = await roomWithKariAndOla()
        const anotherSpace = await createChatSpace({ name: 'Annet' })
        const unreadable = await prisma.chatSpaceRoom.create({
            data: { spaceId: anotherSpace.id, name: 'Borte', matrixRoomId: '!ukjent:chat.test' },
        })
        const failing = await messageIn(unreadable, kari)
        await messageIn(room, kari)
        const readRoom = homeserver.readRoom.bind(homeserver)
        homeserver.readRoom = roomId => (roomId === '!ukjent:chat.test'
            ? Promise.reject(new Error('The homeserver does not answer for the room'))
            : readRoom(roomId))

        await expect(syncAndReadNotifications()).rejects.toThrow(`notify of the message ${failing.matrixEventId}`)
        expect(await prisma.notification.count()).toBe(1)
        expect(await prisma.chatRoomMessage.findUniqueOrThrow({ where: { id: failing.id } }))
            .toMatchObject({ notifiedAt: null })

        await prisma.chatRoomMessage.update({
            where: { id: failing.id },
            data: { sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
        })
        await expect(syncAndReadNotifications()).rejects.toThrow('sync the space Annet')
        expect(await prisma.chatRoomMessage.count({ where: { id: failing.id } })).toBe(0)
    })

    test('is notified of once, and with nobody else in the room not at all', async () => {
        const { room, kari, ola } = await roomWithKariAndOla()
        await messageIn(room, kari)
        expect(await syncAndReadNotifications()).toHaveLength(1)
        expect(await syncAndReadNotifications()).toHaveLength(1)

        const { matrixRoomId } = await prisma.chatSpaceRoom.findUniqueOrThrow({ where: { id: room.id } })
        homeserver.room(matrixRoomId!).members = [homeserver.botUserId, ola.matrixId]
        const alone = await messageIn(room, ola)
        expect(await syncAndReadNotifications()).toHaveLength(1)
        expect(await prisma.chatRoomMessage.findUniqueOrThrow({ where: { id: alone.id } }))
            .toMatchObject({ notifiedAt: expect.any(Date) })
    })

    test('is forgotten a day after it was notified of, and not before', async () => {
        const { room, kari } = await roomWithKariAndOla()
        const recent = await messageIn(room, kari)
        const old = await messageIn(room, kari)
        await syncAndReadNotifications()
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        await prisma.chatRoomMessage.update({ where: { id: old.id }, data: { notifiedAt: twoDaysAgo } })

        await syncChat(homeserver)

        const kept = await prisma.chatRoomMessage.findMany({ select: { id: true } })
        expect(kept).toEqual([{ id: recent.id }])
    })
})

describe('a message outside every space', () => {
    function messageInStandalone(standaloneMatrixRoomId: string, sender: { matrixId: string }) {
        return prisma.chatRoomMessage.create({
            data: {
                standaloneMatrixRoomId,
                matrixEventId: `$message${++sent}`,
                senderMatrixId: sender.matrixId,
                sentAt: new Date(),
            },
        })
    }

    async function directAndGroupChannelId() {
        const channel = await prisma.notificationChannel.findUniqueOrThrow({ where: { special: 'CHAT_DIRECT_AND_GROUP' } })
        return channel.id
    }

    test('to one user is notified of to them, as written to them', async () => {
        const [kari, ola] = await Promise.all(['kari', 'ola'].map(createChatUser))
        const direct = homeserver.createStandaloneRoom({ members: [kari.matrixId, ola.matrixId] })
        await messageInStandalone(direct, kari)

        await expect(syncAndReadNotifications()).resolves.toEqual([{
            title: 'kari Nordmann skrev til deg',
            message: 'Meldingen ligger i direktemeldingene dine på chatten.',
            url: '/users/me/chat',
            channelId: await directAndGroupChannelId(),
            to: [ola.id],
        }])
    })

    test('reaches one who is written to for the first time, and so is only invited', async () => {
        const [kari, ola] = await Promise.all(['kari', 'ola'].map(createChatUser))
        const direct = homeserver.createStandaloneRoom({ members: [kari.matrixId], invited: [ola.matrixId] })
        await messageInStandalone(direct, kari)

        await expect(syncAndReadNotifications()).resolves.toEqual([
            expect.objectContaining({ title: 'kari Nordmann skrev til deg', to: [ola.id] }),
        ])
    })

    test('in a group room is notified of to the others in it, by the name of the room', async () => {
        const [kari, ola, per, guro] = await Promise.all(['kari', 'ola', 'per', 'guro'].map(createChatUser))
        const named = homeserver.createStandaloneRoom({
            members: [kari, ola, per].map(user => user.matrixId),
            name: 'Hytteturen',
        })
        const unnamed = homeserver.createStandaloneRoom({ members: [kari, ola, guro].map(user => user.matrixId) })
        await messageInStandalone(named, kari)
        await messageInStandalone(unnamed, kari)

        await expect(syncAndReadNotifications()).resolves.toEqual([
            expect.objectContaining({
                title: 'kari Nordmann skrev i Hytteturen',
                message: 'Meldingen ligger i en gruppe du er med i på chatten.',
                channelId: await directAndGroupChannelId(),
                to: [ola.id, per.id].sort(),
            }),
            expect.objectContaining({ title: 'kari Nordmann skrev i en gruppe', to: [ola.id, guro.id].sort() }),
        ])
    })

    test('is one notification with what else the same user wrote in the room since the last run', async () => {
        const [kari, ola] = await Promise.all(['kari', 'ola'].map(createChatUser))
        const direct = homeserver.createStandaloneRoom({ members: [kari.matrixId, ola.matrixId] })
        await messageInStandalone(direct, kari)
        await messageInStandalone(direct, kari)
        await messageInStandalone(direct, ola)

        const notifications = await syncAndReadNotifications()
        expect(notifications.map(notification => [notification.title, notification.to])).toEqual([
            ['kari Nordmann skrev til deg', [ola.id]],
            ['ola Nordmann skrev til deg', [kari.id]],
        ])
        expect(await prisma.chatRoomMessage.count({ where: { notifiedAt: null } })).toBe(0)

        await messageInStandalone(direct, kari)
        expect(await syncAndReadNotifications()).toHaveLength(3)
    })

    test('is notified of to nobody when the homeserver has no such room, or nobody else is in it', async () => {
        const kari = await createChatUser('kari')
        const alone = homeserver.createStandaloneRoom({ members: [kari.matrixId] })
        await messageInStandalone(alone, kari)
        await messageInStandalone('!ukjent:chat.test', kari)

        expect(await syncAndReadNotifications()).toHaveLength(0)
        expect(await prisma.chatRoomMessage.count({ where: { notifiedAt: null } })).toBe(0)
    })
})
