import { fakeChatBrowser, stopSyncedChatClients, syncedChatClient, tameChatSdk } from 'tests/chatSessionBrowser'
import { INVITED_ANSWER_WAIT_MS } from '@/lib/chatSession/invited'
import {
    directInvitationFrom,
    directRoomWith,
    joinedRoom,
    kindOf,
    nameOfMembers,
    watchDirectRoomWith,
    watchStandaloneRooms,
} from '@/lib/chatSession/rooms'
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
const madeBy = (userId: string) => stateEvent('m.room.create', userId, {})
/** A room the user is in, which the user made where nobody else is said to have. */
const joined = (state: object[], timeline: object[] = [], maker = KARI) => ({
    state: { events: [madeBy(maker), ...state] },
    timeline: { events: timeline },
})
/** A room its maker has asked the user into as into a direct message, with whatever more the invitation carries. */
const invitedBy = (inviter: object, inviterId: string, more: object[] = [madeBy(inviterId)]) => ({
    invite_state: {
        events: [stateEvent('m.room.member', inviterId, { membership: 'invite', is_direct: true }, KARI), inviter, ...more],
    },
})
/**
 * A room the user is alone in, as Synapse tells a client that loads members lazily of it whole:
 * those asked in are counted, and are not among the members it names.
 */
const startedWith = (...invited: string[]) => ({
    'org.matrix.msc4222.state_after': { events: [madeBy(KARI), kari] },
    timeline: { events: [] },
    summary: { 'm.joined_member_count': 1, 'm.invited_member_count': invited.length, 'm.heroes': invited },
})
const settled = () => new Promise(resolve => setTimeout(resolve, 30))

/** Kari's browser, signed in and with the client running, in the rooms given. */
async function inRooms(rooms: object) {
    const fake = fakeChatBrowser()
    storeSession(fake.browser, ofKari)
    fake.chat.rooms = rooms
    const { tell } = fake.tellingOfNews()
    return { fake, client: await syncedChatClient(fake.browser, KARI), tell }
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
                '!overtatt:chat.test': joined([askedInByOla, olaLeft, per], [message('$overtatt', 9000)], OLA),
                '!forlatt:chat.test': joined([askedInByOla, olaLeft], [message('$forlatt', 9500)], OLA),
            },
        })

        expect(client.getRoom('!overtatt:chat.test')?.guessDMUserId()).toBe(OLA)
        expect(directRoomWith(client, OLA)?.roomId).toBe('!ekte:chat.test')
        // Ola made the room, and may have made it so that he still reads there.
        expect(directRoomWith(client, PER)).toBeNull()
    })

    test('is not a room others get into or read: one a third made, one anyone joins, one anyone reads', async () => {
        const askedIn = (userId: string) => stateEvent('m.room.member', KARI, { membership: 'invite' }, userId)
        const olaLeft = member(OLA, 'Ola Nordmann', 'leave')
        const joinRule = stateEvent('m.room.join_rules', KARI, { join_rule: 'public' })
        const history = (visibility: string) =>
            stateEvent('m.room.history_visibility', KARI, { history_visibility: visibility })
        const { client } = await inRooms({
            join: {
                '!av-tredje:chat.test': joined([kari, olaLeft, askedIn(PER)], [message('$tredje', 1000)], OLA),
                '!uten-opphav:chat.test': { state: { events: [kari, per] }, timeline: { events: [] } },
                '!alle-blir-med:chat.test': joined([kari, per, joinRule], [message('$apent', 2000)]),
                '!alle-leser:chat.test': joined([kari, per, history('world_readable')], [message('$lesbart', 3000)], PER),
            },
        })

        expect(directRoomWith(client, PER)).toBeNull()
        expect(client.getRooms().map(kindOf)).toEqual(['GROUP', 'GROUP', 'GROUP', 'GROUP'])
    })

    test('is one whose history is for those in it, made by either of the two', async () => {
        const history = stateEvent('m.room.history_visibility', PER, { history_visibility: 'invited' })
        const { client } = await inRooms({ join: { '!av-per:chat.test': joined([kari, per, history], [], PER) } })

        expect(directRoomWith(client, PER)?.roomId).toBe('!av-per:chat.test')
    })

    test('is a room they are asked into and have not answered, and not one a third is in or asked into too', async () => {
        const askedIn = (userId: string) => stateEvent('m.room.member', KARI, { membership: 'invite' }, userId)
        const perLeft = member(PER, 'Per Hansen', 'leave')
        const { client } = await inRooms({
            join: {
                '!venter:chat.test': joined([kari, askedIn(OLA), perLeft], [message('$venter', 1000)]),
                '!tre:chat.test': joined([kari, askedIn(OLA), askedIn(PER)], [message('$tre', 2000)]),
            },
        })

        expect(directRoomWith(client, OLA)?.roomId).toBe('!venter:chat.test')
        expect(directRoomWith(client, PER)).toBeNull()
    })

    test('is never a room with the user alone, asked for by their own id', async () => {
        const { client } = await inRooms({
            join: { '!av-meg:chat.test': joined([kari, stateEvent('m.room.member', KARI, { membership: 'invite' }, OLA)]) },
        })

        expect(directRoomWith(client, KARI)).toBeNull()
    })
})

describe('the direct message with a user who has not answered, in a page that is loaded anew', () => {
    const MEMBERS = `/_matrix/client/v3/rooms/${encodeURIComponent('!venter:chat.test')}/members`
    const olaAskedIn = stateEvent('m.room.member', KARI, { membership: 'invite', displayname: 'Ola Nordmann' }, OLA)

    test('is looked for until the homeserver has said who is asked in, and is then the room, by their name', async () => {
        const { fake, client } = await inRooms({
            join: { '!venter:chat.test': startedWith(OLA), '!alene:chat.test': startedWith() },
        })
        fake.answer(MEMBERS, () => ({ body: { chunk: [kari, olaAskedIn] } }))
        const watched = watchDirectRoomWith(client, OLA)
        const list = watchStandaloneRooms(client, [])

        expect(directRoomWith(client, OLA)).toBeNull()
        expect(watched.read()).toBe('LOOKING')
        expect(list.read().map(room => room.name)).toEqual(['@ola:chat.test', 'Tomt rom'])

        let told = 0
        watched.subscribe(() => told++)
        list.subscribe(() => undefined)
        await settled()

        expect(told).toBe(1)
        expect(watched.read()).toMatchObject({ roomId: '!venter:chat.test' })
        expect(list.read().map(room => room.name)).toEqual(['Ola Nordmann', 'Tomt rom'])
        // Asked of the room with one who is asked in, once, and not of the room with nobody.
        const askedOf = fake.calls.map(call => call.url.pathname).filter(pathname => pathname.endsWith('/members'))
        expect(askedOf).toEqual([MEMBERS])
    })

    test('is asked for again after an answer that did not come, and is none once an answer names nobody', async () => {
        const { fake, client, tell } = await inRooms({ join: { '!venter:chat.test': startedWith(OLA) } })
        fake.answer(MEMBERS, () => 'UNREACHABLE')
        const watched = watchDirectRoomWith(client, OLA)
        watched.subscribe(() => undefined)
        await settled()
        expect(watched.read()).toBe('LOOKING')

        fake.answer(MEMBERS, () => ({ body: { chunk: [kari] } }))
        tell({})
        await settled()
        expect(watched.read()).toBeNull()

        tell({})
        await settled()
        expect(fake.callsTo(MEMBERS)).toHaveLength(2)
    })

    test('is looked for only where the room may be theirs, and no longer than an answer is waited for', async () => {
        const { fake, client, tell } = await inRooms({ join: { '!venter:chat.test': startedWith(OLA) } })
        fake.answer(MEMBERS, () => 'NEVER')
        const [withOla, withPer] = [watchDirectRoomWith(client, OLA), watchDirectRoomWith(client, PER)]
        withOla.subscribe(() => undefined)
        await settled()

        expect(withOla.read()).toBe('LOOKING')
        expect(withPer.read()).toBeNull()

        const now = Date.now()
        const clock = jest.spyOn(Date, 'now').mockReturnValue(now + INVITED_ANSWER_WAIT_MS - 1000)
        tell({})
        await settled()
        expect(withOla.read()).toBe('LOOKING')

        clock.mockReturnValue(now + INVITED_ANSWER_WAIT_MS + 1000)
        tell({})
        await settled()
        expect(withOla.read()).toBeNull()
        clock.mockRestore()
    })
})

describe('a direct message the user is asked into', () => {
    test('is one its maker asked the user into as into one, without a name, that only one asked in may join', async () => {
        const joinRule = stateEvent('m.room.join_rules', PER, { join_rule: 'public' })
        const { client } = await inRooms({
            invite: {
                '!fra-ola:chat.test': invitedBy(ola, OLA),
                '!med-navn:chat.test': invitedBy(per, PER, [madeBy(PER), named('Fest')]),
                '!av-en-annen:chat.test': invitedBy(per, PER, [madeBy(OLA)]),
                '!for-alle:chat.test': invitedBy(per, PER, [madeBy(PER), joinRule]),
            },
        })

        expect(directInvitationFrom(client, OLA)?.roomId).toBe('!fra-ola:chat.test')
        expect(directInvitationFrom(client, PER)).toBeNull()
        expect(watchStandaloneRooms(client, []).read().map(room => [room.id, room.kind])).toEqual([
            ['!med-navn:chat.test', 'GROUP'],
            ['!fra-ola:chat.test', 'DIRECT'],
            ['!av-en-annen:chat.test', 'GROUP'],
            ['!for-alle:chat.test', 'GROUP'],
        ])
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
