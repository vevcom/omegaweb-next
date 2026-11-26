import { configFor, fakeChatBrowser, REDIRECT_URI, tameChatSdk } from 'tests/chatSessionBrowser'
import { runChatSession } from '@/lib/chatSession/run'
import { signOut } from '@/lib/chatSession/client'
import { standaloneRoomsOf } from '@/lib/chatSession/rooms'
import { readStoredSession, requestSignOut, storeSession } from '@/lib/chatSession/storage'
import { afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import type { ChatSessionRun, ChatSessionState } from '@/lib/chatSession/run'

const KARI = '@kari:chat.test'
const OLA = '@ola:chat.test'
const SYNC = '/_matrix/client/v3/sync'
const TOKEN = '/oauth2/token'
const REVOKE = '/oauth2/revoke'
const ofKari = { userId: KARI, deviceId: 'KARISDEVICE1', accessToken: 'access-0', refreshToken: 'refresh-0' }
const ofOla = { userId: OLA, deviceId: 'OLASDEVICE12', accessToken: 'olas-access', refreshToken: 'olas-refresh' }

beforeAll(() => tameChatSdk(jest.spyOn))

type Fake = ReturnType<typeof fakeChatBrowser>
const runs: ChatSessionRun[] = []
// The SDK finishes what it was writing after it is stopped, which is waited out before the next test.
afterEach(async () => {
    runs.splice(0).forEach(run => run.stop())
    await new Promise(resolve => setTimeout(resolve, 50))
})

/** A tab of the browser on a chat page, with `matrixUserId` signed in here, and every state it has shown. */
function tab(fake: Fake, matrixUserId: string | null, browser = fake.browser) {
    const states: ChatSessionState[] = []
    const run = runChatSession({
        config: configFor(matrixUserId),
        browser,
        redirectUri: REDIRECT_URI,
        show: state => states.push(state),
    })
    runs.push(run)
    const shown = async <Shown extends ChatSessionState>(isShown: (state: ChatSessionState) => state is Shown) => {
        for (let waited = 0; waited < 200; waited++) {
            const state = states.at(-1)
            if (state && isShown(state)) return state
            await new Promise(resolve => setTimeout(resolve, 10))
        }
        const were = states.map(state => JSON.stringify({ ...state, client: undefined }))
        throw new Error(`Never shown. The states were ${were.join(' ')}`)
    }
    return {
        run,
        states,
        signedOut: () => shown(
            (state): state is ChatSessionState & { status: 'SIGNED_OUT' } => state.status === 'SIGNED_OUT'
        ),
        has: (status: 'WAITING_FOR_TAB' | 'SIGNING_IN' | 'FAILED') =>
            shown((state): state is ChatSessionState => state.status === status),
        // The SDK says it has synced before it sends its long poll, and a tab that takes over says so
        // from what the first synced before it has sent anything. So a client is connected once the
        // homeserver holds its long poll, and what it sent is all there then.
        running: (connection: 'CONNECTED' | 'LOST') => shown(
            (state): state is ChatSessionState & { status: 'RUNNING' } =>
                state.status === 'RUNNING' && state.connection === connection
                && (connection === 'LOST' || fake.heldRequests() > 0)
        ),
    }
}

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
const named = (name: string) => stateEvent('m.room.name', OLA, { name })
const joined = (...state: object[]) => ({ state: { events: state }, timeline: { events: [] } })

describe('a tab on a chat page', () => {
    test('has no session to run in a browser that kept none, and asks the chat nothing', async () => {
        const fake = fakeChatBrowser()
        await expect(tab(fake, KARI).signedOut()).resolves.toMatchObject({ reason: 'NO_SESSION' })
        expect(fake.calls).toHaveLength(0)
    })

    test('runs the client of the session the browser kept for the user', async () => {
        const fake = fakeChatBrowser()
        storeSession(fake.browser, ofKari)

        const { client } = await tab(fake, KARI).running('CONNECTED')

        expect(client.getUserId()).toBe(KARI)
        expect(client.getDeviceId()).toBe('KARISDEVICE1')
        expect(fake.callsTo(SYNC)[0].token).toBe('Bearer access-0')
        expect(fake.leftFor).toHaveLength(0)
    })

    test('says so when the homeserver cannot be reached, and keeps the session', async () => {
        const fake = fakeChatBrowser()
        storeSession(fake.browser, ofKari)
        fake.answer('/_matrix/client/v3/pushrules/', () => 'UNREACHABLE')
        fake.answer(SYNC, () => 'UNREACHABLE')

        await tab(fake, KARI).running('LOST')
        expect(readStoredSession(fake.browser)).toEqual(ofKari)
    })

    test('forgets the session and its device when the homeserver says it has ended', async () => {
        const fake = fakeChatBrowser()
        storeSession(fake.browser, ofKari)
        fake.answer(SYNC, call => (call.url.searchParams.has('since')
            ? { status: 401, body: { errcode: 'M_UNKNOWN_TOKEN', error: 'Unknown token' } }
            : { body: { next_batch: 'first' } }))
        fake.answer(TOKEN, () => ({ status: 400, body: { error: 'invalid_grant' } }))

        const chatPage = tab(fake, KARI)

        await expect(chatPage.signedOut()).resolves.toMatchObject({ reason: 'ENDED' })
        expect(fake.callsTo(TOKEN).map(call => call.form.get('refresh_token'))).toEqual(['refresh-0'])
        expect(fake.kept.size).toBe(0)
        expect(chatPage.states.filter(state => state.status === 'SIGNED_OUT')).toHaveLength(1)
    })

    test('stops and says the session has ended when another tab signs the browser out', async () => {
        const fake = fakeChatBrowser()
        storeSession(fake.browser, ofKari)
        const chatPage = tab(fake, KARI)
        const { client } = await chatPage.running('CONNECTED')

        await signOut(configFor(KARI), fake.openTab())

        await expect(chatPage.signedOut()).resolves.toMatchObject({ reason: 'ENDED' })
        expect(client.clientRunning).toBe(false)
        expect(fake.kept.size).toBe(0)
    })
})

describe('a session the browser kept for another user than the one signed in here', () => {
    test.each([
        ['another user', KARI],
        ['a user without an account on the chat', null],
    ])('is ended at the chat\'s sign in and forgotten, and never run, for %s', async (_, matrixUserId) => {
        const fake = fakeChatBrowser()
        storeSession(fake.browser, ofOla)

        await expect(tab(fake, matrixUserId).signedOut()).resolves.toMatchObject({ reason: 'NO_SESSION' })

        expect(fake.callsTo(REVOKE).map(call => call.form.get('token'))).toEqual(['olas-refresh'])
        expect(fake.kept.size).toBe(0)
        expect(fake.calls.filter(call => call.token !== null)).toHaveLength(0)
    })

    test('is forgotten also when the chat cannot be reached to end it', async () => {
        const fake = fakeChatBrowser()
        storeSession(fake.browser, ofOla)
        fake.answer('/_matrix/client/v1/auth_metadata', () => 'UNREACHABLE')

        await expect(tab(fake, KARI).signedOut()).resolves.toMatchObject({ reason: 'NO_SESSION' })
        expect(fake.kept.size).toBe(0)
    })
})

describe('a second tab on a chat page', () => {
    test('waits while the first runs the client, and takes over when the first lets go', async () => {
        const fake = fakeChatBrowser()
        storeSession(fake.browser, ofKari)
        const first = tab(fake, KARI)
        await first.running('CONNECTED')

        const second = tab(fake, KARI, fake.openTab())
        await second.has('WAITING_FOR_TAB')
        expect(fake.callsTo(SYNC)).toHaveLength(2)

        first.run.stop()
        await second.running('CONNECTED')
        expect(second.states[0]).toEqual({ status: 'WAITING_FOR_TAB' })
        // It goes on from what the first synced, which is kept for the user.
        expect(fake.callsTo(SYNC).filter(call => !call.url.searchParams.has('since'))).toHaveLength(1)
    })

    test('runs the client with the tokens the first traded for while it waited', async () => {
        const fake = fakeChatBrowser()
        storeSession(fake.browser, ofKari)
        const first = tab(fake, KARI)
        await first.running('CONNECTED')
        const second = tab(fake, KARI, fake.openTab())
        await second.has('WAITING_FOR_TAB')

        storeSession(fake.browser, { ...ofKari, accessToken: 'access-traded', refreshToken: 'refresh-traded' })
        first.run.stop()

        await second.running('CONNECTED')
        expect(fake.callsTo(SYNC).at(-1)?.token).toBe('Bearer access-traded')
    })
})

describe('a tab on a chat page with no session to run', () => {
    test('keeps no other tab from signing in, and waits for that tab once it has', async () => {
        const fake = fakeChatBrowser()
        const settings = tab(fake, KARI)
        await settings.signedOut()

        const messages = tab(fake, KARI, fake.openTab())
        await messages.signedOut()
        await messages.run.signIn()
        const state = new URL(fake.leftFor[0]).searchParams.get('state') ?? ''
        await messages.run.completeSignIn(new URLSearchParams({ state, code: 'the-code' }))

        await messages.running('CONNECTED')
        expect(messages.states.map(shown => shown.status)).not.toContain('WAITING_FOR_TAB')
        await settings.has('WAITING_FOR_TAB')

        messages.run.stop()
        await settings.running('CONNECTED')
    })
})

describe('what a user has synced in the browser', () => {
    const KARIS = 'matrix-js-sdk:ow-chat-sync:@kari:chat.test'
    const OLAS = 'matrix-js-sdk:ow-chat-sync:@ola:chat.test'
    const roomNamed = (name: string, ...members: object[]) =>
        joined(stateEvent('m.room.create', OLA, {}), named(name), ...members)
    const kari = member(KARI, 'Kari Nordmann')
    const ola = member(OLA, 'Ola Nordmann')

    test('is kept in a database of the user\'s own, and deleted when the session is signed out', async () => {
        const fake = fakeChatBrowser()
        storeSession(fake.browser, ofKari)
        await tab(fake, KARI).running('CONNECTED')
        await expect(fake.databases()).resolves.toEqual([KARIS])

        await signOut(configFor(KARI), fake.openTab())

        await expect(fake.databases()).resolves.toEqual([])
    })

    test('is deleted when the homeserver ends the session', async () => {
        const fake = fakeChatBrowser()
        storeSession(fake.browser, ofKari)
        fake.answer(SYNC, call => (call.url.searchParams.has('since')
            ? { status: 401, body: { errcode: 'M_UNKNOWN_TOKEN', error: 'Unknown token' } }
            : { body: { next_batch: 'first' } }))
        fake.answer(TOKEN, () => ({ status: 400, body: { error: 'invalid_grant' } }))

        await tab(fake, KARI).signedOut()

        await expect(fake.databases()).resolves.toEqual([])
    })

    test('is deleted with a kept session that is another user\'s, and is never the next user\'s', async () => {
        const fake = fakeChatBrowser()
        storeSession(fake.browser, ofKari)
        fake.chat.rooms = { join: { '!karis:chat.test': roomNamed('Karis gruppe', kari, ola) } }
        const karisTab = tab(fake, KARI)
        await karisTab.running('CONNECTED')
        karisTab.run.stop()

        fake.chat.account = OLA
        fake.chat.rooms = { join: { '!olas:chat.test': roomNamed('Olas gruppe', ola) } }
        const olasTab = tab(fake, OLA)
        await olasTab.signedOut()
        await expect(fake.databases()).resolves.toEqual([])
        await olasTab.run.signIn()
        const state = new URL(fake.leftFor[0]).searchParams.get('state') ?? ''
        await olasTab.run.completeSignIn(new URLSearchParams({ state, code: 'the-code' }))

        const { client } = await olasTab.running('CONNECTED')
        expect(standaloneRoomsOf(client, []).map(room => room.name)).toEqual(['Olas gruppe'])
        await expect(fake.databases()).resolves.toEqual([OLAS])
    })

    test('is not opened by another user, and is deleted, also when it was left behind', async () => {
        const fake = fakeChatBrowser()
        storeSession(fake.browser, ofKari)
        fake.chat.rooms = { join: { '!karis:chat.test': roomNamed('Karis gruppe', kari, ola) } }
        const karisTab = tab(fake, KARI)
        await karisTab.running('CONNECTED')
        karisTab.run.stop()
        await expect(fake.databases()).resolves.toEqual([KARIS])

        // As when the session was forgotten and the deletion never went through.
        storeSession(fake.browser, ofOla)
        fake.chat.rooms = { join: { '!olas:chat.test': roomNamed('Olas gruppe', ola) } }
        const { client } = await tab(fake, OLA).running('CONNECTED')

        expect(standaloneRoomsOf(client, []).map(room => room.name)).toEqual(['Olas gruppe'])
        expect(fake.callsTo(SYNC).at(-2)?.url.searchParams.has('since')).toBe(false)
        await expect(fake.databases()).resolves.toEqual([OLAS])
    })
})

describe('the client of a tab that leaves the chat pages', () => {
    test('is stopped, and its store closed', async () => {
        const fake = fakeChatBrowser()
        storeSession(fake.browser, ofKari)
        const chatPage = tab(fake, KARI)
        const { client } = await chatPage.running('CONNECTED')
        const closed = jest.spyOn(client.store, 'destroy')

        chatPage.run.stop()

        expect(client.clientRunning).toBe(false)
        expect(closed).toHaveBeenCalledTimes(1)
    })
})

describe('a tab the logout page has asked a sign out in', () => {
    test('ends the session and runs nothing', async () => {
        const fake = fakeChatBrowser()
        storeSession(fake.browser, ofKari)
        await fake.makeDatabase('matrix-js-sdk:ow-chat-sync:@kari:chat.test')
        requestSignOut(fake.browser)

        await expect(tab(fake, KARI).signedOut()).resolves.toMatchObject({ reason: 'ENDED' })

        expect(fake.callsTo(REVOKE).map(call => call.form.get('token'))).toEqual(['refresh-0'])
        expect(fake.callsTo(SYNC)).toHaveLength(0)
        expect(fake.kept.size).toBe(0)
        await expect(fake.databases()).resolves.toEqual([])
    })

    test('says it is signed out also when the chat cannot be reached, with the session forgotten', async () => {
        const fake = fakeChatBrowser()
        storeSession(fake.browser, ofKari)
        fake.answer('/_matrix/client/v1/auth_metadata', () => 'UNREACHABLE')
        requestSignOut(fake.browser)

        await expect(tab(fake, KARI).signedOut()).resolves.toMatchObject({ reason: 'ENDED' })
        expect(fake.kept.size).toBe(0)
    })

    test('is asked once: the tab runs the session it has the next time', async () => {
        const fake = fakeChatBrowser()
        requestSignOut(fake.browser)
        await tab(fake, KARI).signedOut()

        storeSession(fake.browser, ofKari)
        await tab(fake, KARI).running('CONNECTED')
        expect(fake.callsTo(REVOKE)).toHaveLength(0)
    })

    test('is not another tab: one that was not asked runs the session', async () => {
        const fake = fakeChatBrowser()
        storeSession(fake.browser, ofKari)
        requestSignOut(fake.openTab())

        await tab(fake, KARI).running('CONNECTED')
        expect(readStoredSession(fake.browser)).toEqual(ofKari)
    })
})

describe('signing in from a chat page', () => {
    test('sends the browser to the chat\'s sign in', async () => {
        const fake = fakeChatBrowser()
        const chatPage = tab(fake, KARI)
        await chatPage.signedOut()

        await chatPage.run.signIn()

        expect(chatPage.states.at(-1)).toEqual({ status: 'SIGNING_IN' })
        expect(fake.leftFor).toHaveLength(1)
        expect(fake.leftFor[0]).toMatch(/^https:\/\/account\.chat\.test\/authorize\?/)
    })

    test('fails, and sends the browser nowhere, when the homeserver cannot be reached', async () => {
        const fake = fakeChatBrowser()
        fake.answer('/_matrix/client/v1/auth_metadata', () => 'UNREACHABLE')
        const chatPage = tab(fake, KARI)
        await chatPage.signedOut()

        await chatPage.run.signIn()

        expect(chatPage.states.at(-1)).toEqual({ status: 'FAILED' })
        expect(fake.leftFor).toHaveLength(0)
    })

    test('runs the client once the answer of the chat\'s sign in is the user\'s', async () => {
        const fake = fakeChatBrowser()
        const chatPage = tab(fake, KARI)
        await chatPage.signedOut()
        await chatPage.run.signIn()
        const state = new URL(fake.leftFor[0]).searchParams.get('state') ?? ''

        await chatPage.run.completeSignIn(new URLSearchParams({ state, code: 'the-code' }))

        const { client } = await chatPage.running('CONNECTED')
        expect(client.getUserId()).toBe(KARI)
        expect(fake.callsTo(SYNC)[0].token).toBe('Bearer access-1')
    })

    test('says why when the answer is another user\'s, and runs nothing', async () => {
        const fake = fakeChatBrowser()
        fake.chat.account = OLA
        const chatPage = tab(fake, KARI)
        await chatPage.signedOut()
        await chatPage.run.signIn()
        const state = new URL(fake.leftFor[0]).searchParams.get('state') ?? ''

        await chatPage.run.completeSignIn(new URLSearchParams({ state, code: 'the-code' }))

        expect(chatPage.states.at(-1)).toEqual({ status: 'SIGNED_OUT', reason: 'OTHER_ACCOUNT' })
        expect(fake.callsTo(SYNC)).toHaveLength(0)
    })
})

describe('the rooms of the user outside every space', () => {
    test('are the direct messages and the groups, by name, and not the spaces or their rooms', async () => {
        const fake = fakeChatBrowser()
        storeSession(fake.browser, ofKari)
        const kari = member(KARI, 'Kari Nordmann')
        const ola = member(OLA, 'Ola Nordmann')
        const per = member('@per:chat.test', 'Per Hansen')
        const create = (content: object = {}) => stateEvent('m.room.create', OLA, content)
        fake.chat.rooms = {
            join: {
                '!direkte:chat.test': joined(create(), kari, ola),
                '!gruppe:chat.test': joined(create(), named('Hyttetur'), kari, ola, per),
                '!navnlos:chat.test': joined(create(), kari, ola, per),
                '!to-med-navn:chat.test': joined(create(), named('Ølbrygging'), kari, ola),
                '!vevcom:chat.test': joined(create({ type: 'm.space' }), named('Vevcom'), kari),
                '!eget-omraade:chat.test': joined(create({ type: 'm.space' }), named('Laget i Element'), kari),
                '!prat:chat.test': joined(create(), named('Prat'), kari, ola),
            },
            invite: {
                '!invitasjon:chat.test': {
                    invite_state: {
                        events: [
                            stateEvent('m.room.member', '@per:chat.test', { membership: 'invite', is_direct: true }, KARI),
                            stateEvent('m.room.create', '@per:chat.test', {}),
                            per,
                        ],
                    },
                },
            },
            leave: {
                '!forlatt:chat.test': joined(create(), named('Forlatt'), ola),
            },
        }

        const { client } = await tab(fake, KARI).running('CONNECTED')

        expect(standaloneRoomsOf(client, ['!vevcom:chat.test', '!prat:chat.test'])).toEqual([
            { id: '!gruppe:chat.test', name: 'Hyttetur', kind: 'GROUP', isInvitation: false },
            { id: '!direkte:chat.test', name: 'Ola Nordmann', kind: 'DIRECT', isInvitation: false },
            { id: '!navnlos:chat.test', name: 'Ola Nordmann og Per Hansen', kind: 'GROUP', isInvitation: false },
            { id: '!invitasjon:chat.test', name: 'Per Hansen', kind: 'DIRECT', isInvitation: true },
            { id: '!to-med-navn:chat.test', name: 'Ølbrygging', kind: 'GROUP', isInvitation: false },
        ])
    })
})
