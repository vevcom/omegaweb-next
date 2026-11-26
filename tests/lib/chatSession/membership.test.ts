import { fakeChatBrowser, stopSyncedChatClients, syncedChatClient, tameChatSdk } from 'tests/chatSessionBrowser'
import {
    SYNC_WAIT_MS,
    inviteToRoom,
    joinRoom,
    leaveRoom,
    refusalOf,
    startDirectMessage,
    startGroup,
} from '@/lib/chatSession/membership'
import { directRoomWith, joinedRoom } from '@/lib/chatSession/rooms'
import { storeSession } from '@/lib/chatSession/storage'
import { afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'

const KARI = '@kari:chat.test'
const OLA = '@ola:chat.test'
const PER = '@per:chat.test'
const SIRI = '@siri:chat.test'
const NEW_ROOM = '!nytt:chat.test'
const INVITATION = '!invitasjon:chat.test'
const CREATE = '/_matrix/client/v3/createRoom'
const DIRECT = `/_matrix/client/v3/user/${encodeURIComponent(KARI)}/account_data/m.direct`
const ofRoom = (roomId: string, what: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/${what}`
const ofKari = { userId: KARI, deviceId: 'KARISDEVICE1', accessToken: 'access-0', refreshToken: 'refresh-0' }

beforeAll(() => tameChatSdk(jest.spyOn))
afterEach(stopSyncedChatClients)

const member = (userId: string, membership = 'join', sender = userId, content: object = {}) => ({
    type: 'm.room.member',
    sender,
    content: { membership, ...content },
    state_key: userId,
    event_id: `$member-${userId}-${membership}`,
    origin_server_ts: 1,
})
const kari = member(KARI)
const olaAskedIn = member(OLA, 'invite', KARI)
const madeBy = (userId: string) => ({ ...member(userId), type: 'm.room.create', state_key: '', event_id: `$made-${userId}` })
/**
 * A room as Synapse tells a client that loads members lazily of it: the state after its timeline,
 * which names those who wrote, and the count of those who are in it or asked into it.
 */
const told = (members: object[], invited: string[] = []) => ({
    'org.matrix.msc4222.state_after': { events: [madeBy(KARI), ...members] },
    timeline: { events: members },
    summary: { 'm.joined_member_count': 1, 'm.invited_member_count': invited.length, 'm.heroes': invited },
})
/** A room the other one made, which the two are in. */
const joinedWith = (other: string) => ({
    state: { events: [madeBy(other), kari, member(other)] },
    timeline: { events: [] },
})
const askedIntoDirectBy = (inviter: string) => ({
    invite_state: { events: [madeBy(inviter), member(KARI, 'invite', inviter, { is_direct: true }), member(inviter)] },
})
const settled = () => new Promise(resolve => setTimeout(resolve, 30))

/** Kari's browser, signed in and with the client running, in the rooms given, on a homeserver that makes NEW_ROOM. */
async function inRooms(rooms: object = {}) {
    const fake = fakeChatBrowser()
    storeSession(fake.browser, ofKari)
    fake.chat.rooms = rooms
    const { tell } = fake.tellingOfNews()
    fake.answer(CREATE, () => ({ body: { room_id: NEW_ROOM } }))
    // The homeserver tells every client of the account of what one of them notes in it.
    fake.answer(DIRECT, call => {
        tell({}, [{ type: 'm.direct', content: call.json }])
        return { body: {} }
    })
    const client = await syncedChatClient(fake.browser, KARI)
    return {
        fake,
        client,
        tell,
        /** What has been written in the room, asked once the SDK has had the time to send it. */
        sentIn: async (roomId: string) => {
            await settled()
            return fake.calls
                .filter(call => call.url.pathname.startsWith(ofRoom(roomId, 'send/m.room.message/')))
                .map(call => (call.json as { body: string }).body)
        },
    }
}

describe('a direct message that is started', () => {
    test('is a room of the two that asks the other in, where the message is written once the client has it', async () => {
        const { fake, client, tell, sentIn } = await inRooms()
        let isStarted = false
        const started = startDirectMessage(client, OLA, ' Hei Ola ').then(room => {
            isStarted = true
            return room
        })
        await settled()

        expect(fake.callsTo(CREATE).map(call => call.json)).toEqual([
            { preset: 'trusted_private_chat', is_direct: true, invite: [OLA] },
        ])

        // The homeserver tells of the room before it tells of the one asked into it.
        tell({ join: { [NEW_ROOM]: told([kari]) } })
        await settled()
        expect(joinedRoom(client, NEW_ROOM)).not.toBeNull()
        expect(isStarted).toBe(false)
        expect(await sentIn(NEW_ROOM)).toEqual([])

        tell({ join: { [NEW_ROOM]: told([olaAskedIn], [OLA]) } })
        expect((await started).roomId).toBe(NEW_ROOM)
        expect(await sentIn(NEW_ROOM)).toEqual(['Hei Ola'])
        expect(directRoomWith(client, OLA)?.roomId).toBe(NEW_ROOM)
        expect(fake.callsTo(DIRECT).map(call => call.json)).toEqual([{ [OLA]: [NEW_ROOM] }])
    })

    test('is one room for the messages written while it is made', async () => {
        const { fake, client, tell, sentIn } = await inRooms()
        // The SDK sends the second once the homeserver has taken the first.
        fake.answerUnder(ofRoom(NEW_ROOM, 'send/'), call => ({
            body: { event_id: `$${(call.json as { body: string }).body}` },
        }))
        const first = startDirectMessage(client, OLA, 'Først')
        const second = startDirectMessage(client, OLA, 'Så')
        await settled()
        tell({ join: { [NEW_ROOM]: told([kari, olaAskedIn], [OLA]) } })
        await Promise.all([first, second])

        expect(fake.callsTo(CREATE)).toHaveLength(1)
        expect(await sentIn(NEW_ROOM)).toEqual(['Først', 'Så'])
    })

    test('is the one the two have, where they have one, and no room is made', async () => {
        const { fake, client, sentIn } = await inRooms({ join: { '!fra-før:chat.test': joinedWith(OLA) } })

        await startDirectMessage(client, OLA, 'Hei igjen')

        expect(fake.callsTo(CREATE)).toEqual([])
        expect(await sentIn('!fra-før:chat.test')).toEqual(['Hei igjen'])
    })

    test('is the user\'s once the homeserver has said who is asked in, where it only counted them', async () => {
        const { fake, client, tell, sentIn } = await inRooms()
        fake.answer(ofRoom(NEW_ROOM, 'members'), () => ({ body: { chunk: [kari, olaAskedIn] } }))
        const started = startDirectMessage(client, OLA, 'Hei')
        await settled()

        tell({ join: { [NEW_ROOM]: told([kari], [OLA]) } })
        await started

        expect(fake.callsTo(ofRoom(NEW_ROOM, 'members'))).toHaveLength(1)
        expect(directRoomWith(client, OLA)?.roomId).toBe(NEW_ROOM)
        expect(await sentIn(NEW_ROOM)).toEqual(['Hei'])
    })

    test('says why when the homeserver does not make it, and is made by a new try', async () => {
        const { fake, client, tell } = await inRooms()
        const refused = (status: number, errcode: string) => () => ({ status, body: { errcode, error: 'Nei' } })
        const refusalWhen = async (answer: Parameters<typeof fake.answer>[1]) => {
            fake.answer(CREATE, answer)
            return refusalOf(await startDirectMessage(client, OLA, 'Hei').catch((error: unknown) => error))
        }

        expect(await refusalWhen(refused(429, 'M_LIMIT_EXCEEDED'))).toBe('LIMITED')
        expect(await refusalWhen(refused(400, 'M_UNKNOWN'))).toBe('REFUSED')
        expect(await refusalWhen(() => 'UNREACHABLE')).toBe('UNREACHABLE')

        fake.answer(CREATE, () => ({ body: { room_id: NEW_ROOM } }))
        const started = startDirectMessage(client, OLA, 'Hei')
        await settled()
        tell({ join: { [NEW_ROOM]: told([kari, olaAskedIn], [OLA]) } })
        expect((await started).roomId).toBe(NEW_ROOM)
        await settled()
    })
})

describe('what is waited for of the sync', () => {
    const syncListeners = (client: { listenerCount: (event: never) => number }) => client.listenerCount('sync' as never)

    test('ends when the one asked in declined before they were counted, in a room that is no direct message', async () => {
        const { client, tell, sentIn } = await inRooms()
        const started = startDirectMessage(client, OLA, 'Hei')
        await settled()

        tell({ join: { [NEW_ROOM]: told([kari]) } })
        await settled()
        tell({ join: { [NEW_ROOM]: told([member(OLA, 'leave')]) } })

        expect((await started).roomId).toBe(NEW_ROOM)
        expect(await sentIn(NEW_ROOM)).toEqual(['Hei'])
        expect(directRoomWith(client, OLA)).toBeNull()
    })

    test('ends as not reached when the client is stopped, before or meanwhile, and leaves nothing listening', async () => {
        const { client } = await inRooms()
        const listening = syncListeners(client)
        const meanwhile = startGroup(client, 'Hyttetur', [OLA]).catch((error: unknown) => refusalOf(error))
        await settled()
        expect(syncListeners(client)).toBe(listening + 1)

        client.stopClient()
        expect(await meanwhile).toBe('UNREACHABLE')
        // The SDK lets go of a listener of its own as it stops.
        const listeningStopped = syncListeners(client)
        expect(listeningStopped).toBeLessThanOrEqual(listening)
        expect(await startGroup(client, 'Hyttetur', [OLA]).catch((error: unknown) => refusalOf(error))).toBe('UNREACHABLE')
        expect(syncListeners(client)).toBe(listeningStopped)
    })

    test('ends as not reached when the sync has not brought a room joined in the time it is given', async () => {
        const { client, tell } = await inRooms()
        const listening = syncListeners(client)
        const joined = joinRoom(client, NEW_ROOM).catch((error: unknown) => refusalOf(error))
        await settled()

        const now = Date.now()
        const clock = jest.spyOn(Date, 'now').mockReturnValue(now + SYNC_WAIT_MS)
        tell({})
        expect(await joined).toBe('UNREACHABLE')
        expect(syncListeners(client)).toBe(listening)
        clock.mockRestore()
    })

    test('goes on for a room that was made however long the sync takes, so it is not made twice', async () => {
        const { fake, client, tell } = await inRooms()
        const started = startGroup(client, 'Hyttetur', [OLA])
        await settled()

        const now = Date.now()
        const clock = jest.spyOn(Date, 'now').mockReturnValue(now + 10 * SYNC_WAIT_MS)
        tell({})
        await settled()
        tell({ join: { [NEW_ROOM]: told([kari, olaAskedIn], [OLA]) } })
        expect((await started).roomId).toBe(NEW_ROOM)
        expect(fake.callsTo(CREATE)).toHaveLength(1)
        clock.mockRestore()
    })
})

describe('a group that is started', () => {
    test('is a room with its name that asks the others in, and is the user\'s once the client has it', async () => {
        const { fake, client, tell } = await inRooms()
        let isStarted = false
        const started = startGroup(client, 'Hyttetur', [OLA, PER]).then(room => {
            isStarted = true
            return room
        })
        await settled()

        expect(fake.callsTo(CREATE).map(call => call.json)).toEqual([
            { preset: 'private_chat', name: 'Hyttetur', invite: [OLA, PER] },
        ])
        expect(isStarted).toBe(false)

        tell({ join: { [NEW_ROOM]: told([kari]) } })
        expect((await started).roomId).toBe(NEW_ROOM)
    })
})

describe('an invitation', () => {
    test('is accepted by joining the room, which is the user\'s once the client has it', async () => {
        const { fake, client, tell } = await inRooms({ invite: { [INVITATION]: askedIntoDirectBy(PER) } })
        let isJoined = false
        const joining = joinRoom(client, INVITATION).then(() => {
            isJoined = true
        })
        await settled()

        expect(fake.callsTo(`/_matrix/client/v3/join/${encodeURIComponent(INVITATION)}`)).toHaveLength(1)
        expect(isJoined).toBe(false)

        tell({ join: { [INVITATION]: joinedWith(PER) } })
        await joining
        expect(directRoomWith(client, PER)?.roomId).toBe(INVITATION)
    })

    test('to a direct message is noted in the account as one, beside those noted at the same time', async () => {
        const { fake, client, tell } = await inRooms({
            invite: {
                [INVITATION]: askedIntoDirectBy(PER),
                '!fra-siri:chat.test': askedIntoDirectBy(SIRI),
                '!gruppe:chat.test': { invite_state: { events: [member(KARI, 'invite', OLA), member(OLA)] } },
            },
        })
        const joining = [INVITATION, '!fra-siri:chat.test', '!gruppe:chat.test'].map(roomId => joinRoom(client, roomId))
        await settled()
        tell({
            join: {
                [INVITATION]: joinedWith(PER),
                '!fra-siri:chat.test': joinedWith(SIRI),
                '!gruppe:chat.test': joinedWith(OLA),
            },
        })
        await Promise.all(joining)
        await settled()

        expect(fake.callsTo(DIRECT).map(call => call.json)).toEqual([
            { [PER]: [INVITATION] },
            { [PER]: [INVITATION], [SIRI]: ['!fra-siri:chat.test'] },
        ])
    })
})

describe('a room that is left', () => {
    test('is one the user is in or asked into, and is left once the client is told so', async () => {
        const { fake, client, tell } = await inRooms({
            join: { '!med:chat.test': joinedWith(OLA) },
            invite: { [INVITATION]: askedIntoDirectBy(PER) },
        })
        const left: string[] = []
        const leaving = ['!med:chat.test', INVITATION].map(roomId => leaveRoom(client, roomId).then(() => left.push(roomId)))
        await settled()

        expect(fake.callsTo(ofRoom('!med:chat.test', 'leave'))).toHaveLength(1)
        expect(fake.callsTo(ofRoom(INVITATION, 'leave'))).toHaveLength(1)
        expect(left).toEqual([])

        tell({ leave: { '!med:chat.test': { timeline: { events: [member(KARI, 'leave')] } } } })
        await leaving[0]
        expect(left).toEqual(['!med:chat.test'])
        expect(joinedRoom(client, '!med:chat.test')).toBeNull()

        tell({ leave: { [INVITATION]: { timeline: { events: [member(KARI, 'leave')] } } } })
        await leaving[1]
        expect(client.getRoom(INVITATION)?.getMyMembership()).toBe('leave')
    })
})

describe('asking more into a room', () => {
    test('goes on past one the homeserver refuses, and stops when it takes no more for now', async () => {
        const { fake, client } = await inRooms({ join: { '!gruppe:chat.test': joinedWith(OLA) } })
        const answers: Record<string, { status: number, body: object }> = {
            [OLA]: { status: 403, body: { errcode: 'M_FORBIDDEN', error: 'Er med' } },
            [PER]: { status: 200, body: {} },
            [SIRI]: { status: 429, body: { errcode: 'M_LIMIT_EXCEEDED', error: 'Vent' } },
        }
        fake.answer(ofRoom('!gruppe:chat.test', 'invite'), call => answers[(call.json as { user_id: string }).user_id])

        await expect(inviteToRoom(client, '!gruppe:chat.test', [OLA, PER, SIRI, '@tor:chat.test']))
            .resolves.toEqual({ invited: [PER], refused: [OLA], stoppedBy: 'LIMITED' })
        expect(fake.callsTo(ofRoom('!gruppe:chat.test', 'invite'))).toHaveLength(3)
    })
})
