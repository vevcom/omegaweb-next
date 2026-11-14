import { beforeAll, afterEach, describe, expect, test } from '@jest/globals'
import type { prisma as prismaClient } from '@/prisma-pn-client-instance'
import type { createChatSpace as createChatSpaceHelper } from 'tests/chatSpaces'
import type * as appserviceRoute from '@/app/api/chat/appservice/[...path]/route'

const HOMESERVER_TOKEN = 'the-homeserver-signs-with-this'
const ROOM = '!rom:chat.test'
const KARI = '@kari:chat.test'
const OLA = '@ola:chat.test'

type Loaded = {
    prisma: typeof prismaClient,
    createChatSpace: typeof createChatSpaceHelper,
    route: typeof appserviceRoute,
}
let loaded: Loaded

// The token is read from the environment when the service is loaded, so it is set first.
beforeAll(async () => {
    process.env.CHAT_HS_TOKEN = HOMESERVER_TOKEN
    loaded = {
        prisma: (await import('@/prisma-pn-client-instance')).prisma,
        createChatSpace: (await import('tests/chatSpaces')).createChatSpace,
        route: await import('@/app/api/chat/appservice/[...path]/route'),
    }
})

afterEach(async () => {
    await loaded.prisma.chatSpace.deleteMany()
})

function message(eventId: string, content: Record<string, unknown>, { roomId = ROOM, sender = KARI } = {}) {
    return { type: 'm.room.message', event_id: eventId, room_id: roomId, sender, origin_server_ts: 1794614405462, content }
}
const text = { msgtype: 'm.text', body: 'Dette lagres aldri' }

function send(events: unknown[], { token = HOMESERVER_TOKEN, path = ['_matrix', 'app', 'v1', 'transactions', '7'] } = {}) {
    const request = new Request(`http://omegaweb-next:3000/api/chat/appservice/${path.join('/')}`, {
        method: 'PUT',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: JSON.stringify({ events }),
    })
    return loaded.route.PUT(request, { params: Promise.resolve({ path }) })
}

async function createRoomOfASpace() {
    const space = await loaded.createChatSpace({ name: 'Vevcom' })
    return loaded.prisma.chatSpaceRoom.create({ data: { spaceId: space.id, name: 'Prat', matrixRoomId: ROOM } })
}

describe('what the homeserver sends the app', () => {
    test('is taken from the homeserver alone, by its token', async () => {
        await createRoomOfASpace()

        const wrong = await send([message('$a', text)], { token: 'not-the-token' })
        expect(wrong.status).toBe(403)
        expect(await wrong.json()).toMatchObject({ errcode: 'M_FORBIDDEN' })
        expect((await send([message('$a', text)], { token: '' })).status).toBe(403)
        expect(await loaded.prisma.chatRoomMessage.count()).toBe(0)

        const right = await send([message('$a', text)])
        expect(right.status).toBe(200)
        expect(await right.json()).toEqual({})
        expect(await loaded.prisma.chatRoomMessage.count()).toBe(1)
    })

    test('keeps a message in a room of a space, with who it mentions and without what it says', async () => {
        const room = await createRoomOfASpace()

        await send([
            message('$plain', text),
            message('$mention', { ...text, 'm.mentions': { user_ids: [OLA] } }),
            message('$room', { ...text, 'm.mentions': { room: true } }),
        ])

        const kept = await loaded.prisma.chatRoomMessage.findMany({ orderBy: { id: 'asc' } })
        expect(kept).toMatchObject([
            { roomId: room.id, matrixEventId: '$plain', senderMatrixId: KARI, mentionedMatrixIds: [], mentionsRoom: false },
            { matrixEventId: '$mention', mentionedMatrixIds: [OLA], mentionsRoom: false },
            { matrixEventId: '$room', mentionedMatrixIds: [], mentionsRoom: true },
        ])
        expect(JSON.stringify(kept)).not.toContain('lagres aldri')
        expect(kept[0].notifiedAt).toBeNull()
    })

    test('lets go of everything else: other rooms, edits, removed messages and what is no message', async () => {
        await createRoomOfASpace()

        const response = await send([
            message('$direct', text, { roomId: '!direkte:chat.test' }),
            message('$edit', { ...text, 'm.relates_to': { rel_type: 'm.replace', event_id: '$plain' } }),
            message('$removed', {}),
            { type: 'm.room.member', event_id: '$join', room_id: ROOM, sender: OLA, content: { membership: 'join' } },
            { type: 'something.unheard.of' },
            'not even an event',
        ])

        expect(response.status).toBe(200)
        expect(await loaded.prisma.chatRoomMessage.count()).toBe(0)
    })

    test('keeps a message once, however many times it is sent', async () => {
        await createRoomOfASpace()

        await send([message('$twice', text)])
        const again = await send([message('$twice', text), message('$new', text)])

        expect(again.status).toBe(200)
        expect(await loaded.prisma.chatRoomMessage.count()).toBe(2)
    })

    test('is answered without the prefix too, and not for anything but a transaction', async () => {
        await createRoomOfASpace()

        expect((await send([message('$legacy', text)], { path: ['transactions', '8'] })).status).toBe(200)
        expect(await loaded.prisma.chatRoomMessage.count()).toBe(1)

        const unrecognized = await send([], { path: ['_matrix', 'app', 'v1', 'ping'] })
        expect(unrecognized.status).toBe(404)
        expect(await unrecognized.json()).toMatchObject({ errcode: 'M_UNRECOGNIZED' })
        expect(loaded.route.GET().status).toBe(404)
    })
})
