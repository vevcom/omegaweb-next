import { fakeChatBrowser, stopSyncedChatClients, syncedChatClient, tameChatSdk } from 'tests/chatSessionBrowser'
import { directRoomWith, joinedRoom, nameOfMembers, watchStandaloneRooms } from '@/lib/chatSession/rooms'
import { storeSession } from '@/lib/chatSession/storage'
import { afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'

const KARI = '@kari:chat.test'
const OLA = '@ola:chat.test'
const PER = '@per:chat.test'
const ofKari = { userId: KARI, deviceId: 'KARISDEVICE1', accessToken: 'access-0', refreshToken: 'refresh-0' }

beforeAll(() => tameChatSdk(jest.spyOn))
afterEach(stopSyncedChatClients)

const stateEvent = (type: string, sender: string, content: object, stateKey = '') => ({
    type,
    sender,
    content,
    state_key: stateKey,
    event_id: `$${type}-${stateKey}-${sender}`,
    origin_server_ts: 1,
})
const member = (userId: string, displayname: string, membership = 'join') =>
    stateEvent('m.room.member', userId, { membership, displayname }, userId)
const kari = member(KARI, 'Kari Nordmann')
const ola = member(OLA, 'Ola Nordmann')
const per = member(PER, 'Per Hansen')
const named = (name: string) => stateEvent('m.room.name', OLA, { name })
const message = (id: string, sentAt: number) => ({
    type: 'm.room.message',
    sender: OLA,
    content: { msgtype: 'm.text', body: 'Hei' },
    event_id: id,
    origin_server_ts: sentAt,
})
const joined = (state: object[], timeline: object[] = []) => ({ state: { events: state }, timeline: { events: timeline } })
const invitedBy = (inviter: object, inviterId: string) => ({
    invite_state: {
        events: [stateEvent('m.room.member', inviterId, { membership: 'invite', is_direct: true }, KARI), inviter],
    },
})
const settled = () => new Promise(resolve => setTimeout(resolve, 30))

/** Kari's browser, signed in and with the client running, in the rooms given. */
async function inRooms(rooms: object) {
    const fake = fakeChatBrowser()
    storeSession(fake.browser, ofKari)
    fake.chat.rooms = rooms
    const { tell } = fake.tellingOfNews()
    return { client: await syncedChatClient(fake.browser, KARI), tell }
}

describe('the name of a room that has none of its own', () => {
    test('is the other one in it', () => {
        expect(nameOfMembers(['Kari Nordmann'], 1)).toBe('Kari Nordmann')
    })

    test('is the others in it, and how many more they are', () => {
        expect(nameOfMembers(['Kari', 'Ola'], 2)).toBe('Kari og Ola')
        expect(nameOfMembers(['Kari', 'Ola', 'Per'], 3)).toBe('Kari og 2 andre')
        expect(nameOfMembers(['Kari'], 3)).toBe('Kari og 2 andre')
    })

    test('says so when nobody else is in it', () => {
        expect(nameOfMembers([], 0)).toBe('Tomt rom')
    })
})

describe('the direct message with a user', () => {
    test('is the room of the two without a name that was last written in, and no group or invitation', async () => {
        const { client } = await inRooms({
            join: {
                '!gammel:chat.test': joined([kari, ola], [message('$gammel', 1000)]),
                '!ny:chat.test': joined([kari, ola], [message('$ny', 2000)]),
                '!to-med-navn:chat.test': joined([named('Ølbrygging'), kari, ola], [message('$navn', 3000)]),
                '!tre:chat.test': joined([kari, ola, per], [message('$tre', 4000)]),
            },
            invite: { '!invitasjon:chat.test': invitedBy(per, PER) },
        })

        expect(directRoomWith(client, OLA)?.roomId).toBe('!ny:chat.test')
        expect(directRoomWith(client, PER)).toBeNull()
    })

    test('is not a room they asked the user into and have left, whoever reads there now', async () => {
        const askedInByOla = {
            ...kari,
            unsigned: { prev_content: { membership: 'invite', is_direct: true }, prev_sender: OLA },
        }
        const olaLeft = member(OLA, 'Ola Nordmann', 'leave')
        const { client } = await inRooms({
            join: {
                '!ekte:chat.test': joined([kari, ola], [message('$ekte', 1000)]),
                '!overtatt:chat.test': joined([askedInByOla, olaLeft, per], [message('$overtatt', 9000)]),
                '!forlatt:chat.test': joined([askedInByOla, olaLeft], [message('$forlatt', 9500)]),
            },
        })

        expect(client.getRoom('!overtatt:chat.test')?.guessDMUserId()).toBe(OLA)
        expect(directRoomWith(client, OLA)?.roomId).toBe('!ekte:chat.test')
        expect(directRoomWith(client, PER)?.roomId).toBe('!overtatt:chat.test')
    })

    test('is not a room they are only asked into, whoever asked them', async () => {
        const olaAskedInBy = (inviterId: string) => stateEvent('m.room.member', inviterId, { membership: 'invite' }, OLA)
        const perLeft = member(PER, 'Per Hansen', 'leave')
        const { client } = await inRooms({
            join: {
                '!av-andre:chat.test': joined([kari, olaAskedInBy(PER), perLeft], [message('$andre', 2000)]),
                '!av-meg:chat.test': joined([kari, olaAskedInBy(KARI)], [message('$meg', 1000)]),
            },
        })

        expect(directRoomWith(client, OLA)).toBeNull()
        expect(directRoomWith(client, PER)).toBeNull()
    })

    test('is never a room with the user alone, asked for by their own id', async () => {
        const { client } = await inRooms({
            join: { '!av-meg:chat.test': joined([kari, stateEvent('m.room.member', KARI, { membership: 'invite' }, OLA)]) },
        })

        expect(directRoomWith(client, KARI)).toBeNull()
    })
})

describe('a room that opens', () => {
    test('is one the user is in, and not one they are asked into or one the client was never told of', async () => {
        const { client } = await inRooms({
            join: { '!med:chat.test': joined([kari, ola]) },
            invite: { '!invitasjon:chat.test': invitedBy(per, PER) },
        })

        expect(joinedRoom(client, '!med:chat.test')?.roomId).toBe('!med:chat.test')
        expect(joinedRoom(client, '!invitasjon:chat.test')).toBeNull()
        expect(joinedRoom(client, '!andres:chat.test')).toBeNull()
    })
})

describe('the list of rooms that is watched', () => {
    test('is the same list after a sync that changed nothing in it, and another after one that did', async () => {
        const { client, tell } = await inRooms({ join: { '!direkte:chat.test': joined([kari, ola]) } })
        const watched = watchStandaloneRooms(client, [])
        let told = 0
        watched.subscribe(() => told++)
        const before = watched.read()

        tell({ join: { '!direkte:chat.test': joined([], [message('$1', 1000)]) } })
        await settled()
        expect(told).toBe(0)
        expect(watched.read()).toBe(before)

        tell({ join: { '!gruppe:chat.test': joined([named('Hyttetur'), kari, ola, per]) } })
        await settled()
        expect(told).toBe(1)
        expect(watched.read().map(room => room.name)).toEqual(['Hyttetur', 'Ola Nordmann'])
    })
})

describe('the unread of a room in the list', () => {
    test('is what the homeserver counts, with the mentions apart, and follows as it counts anew', async () => {
        const counted = (unread: number, mentions: number) => ({
            unread_notifications: { notification_count: unread, highlight_count: mentions },
        })
        const { client, tell } = await inRooms({
            join: {
                '!direkte:chat.test': { ...joined([kari, ola]), ...counted(3, 1) },
                '!gruppe:chat.test': joined([named('Hyttetur'), kari, ola, per]),
            },
        })
        const watched = watchStandaloneRooms(client, [])
        let told = 0
        watched.subscribe(() => told++)

        expect(watched.read()).toMatchObject([
            { name: 'Hyttetur', unread: 0, mentions: 0 },
            { name: 'Ola Nordmann', unread: 3, mentions: 1 },
        ])

        tell({ join: { '!direkte:chat.test': counted(4, 1), '!gruppe:chat.test': counted(1, 0) } })
        await settled()
        expect(told).toBe(1)
        expect(watched.read()).toMatchObject([{ unread: 1, mentions: 0 }, { unread: 4, mentions: 1 }])

        // As when the user has read the direct message, here or in another client.
        tell({ join: { '!direkte:chat.test': counted(0, 0) } })
        await settled()
        expect(told).toBe(2)
        expect(watched.read()).toMatchObject([{ unread: 1, mentions: 0 }, { unread: 0, mentions: 0 }])
    })
})
