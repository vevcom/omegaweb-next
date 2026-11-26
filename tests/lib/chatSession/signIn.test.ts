import { CHAT_AUTH, configFor, fakeChatBrowser, REDIRECT_URI, tameChatSdk } from 'tests/chatSessionBrowser'
import { completeSignIn, startSignIn } from '@/lib/chatSession/signIn'
import { signOut } from '@/lib/chatSession/client'
import { readStoredSession } from '@/lib/chatSession/storage'
import { beforeAll, describe, expect, jest, test } from '@jest/globals'

const KARI = '@kari:chat.test'
const OLA = '@ola:chat.test'
const TOKEN = '/oauth2/token'
const REVOKE = '/oauth2/revoke'

beforeAll(() => tameChatSdk(jest.spyOn))

type Fake = ReturnType<typeof fakeChatBrowser>

/** Starts a sign in as `matrixUserId` is known here, and gives where the browser is sent and what it asks for. */
async function start(fake: Fake, matrixUserId: string | null) {
    const url = new URL(await startSignIn(configFor(matrixUserId), fake.browser, REDIRECT_URI))
    const deviceId = /urn:matrix:client:device:(\S+)/.exec(url.searchParams.get('scope') ?? '')?.[1]
    return { url, state: url.searchParams.get('state') ?? '', deviceId }
}

const answerOf = (state: string, rest: Record<string, string> = { code: 'the-code' }) =>
    new URLSearchParams({ state, ...rest })

/** A whole sign in of `matrixUserId`, which the chat's sign in answers as its `account`. */
async function signIn(fake: Fake, matrixUserId: string | null) {
    const started = await start(fake, matrixUserId)
    const config = configFor(fake.chat.account)
    const result = await completeSignIn(config, fake.browser, REDIRECT_URI, answerOf(started.state))
    return { ...started, result }
}

describe('starting a sign in to the chat', () => {
    test('sends the browser to the chat\'s sign in as the client of the chat pages, for a new device', async () => {
        const fake = fakeChatBrowser()
        const { url, state, deviceId } = await start(fake, KARI)

        expect(`${url.origin}${url.pathname}`).toBe(`${CHAT_AUTH}/authorize`)
        expect(Object.fromEntries(url.searchParams)).toMatchObject({
            response_type: 'code',
            response_mode: 'fragment',
            client_id: '000000000000000000MEGACHAT',
            redirect_uri: REDIRECT_URI,
            code_challenge_method: 'S256',
        })
        expect(state).toHaveLength(24)
        expect(deviceId).toHaveLength(12)
        expect(fake.kept.size).toBe(0)
        expect(JSON.parse(fake.keptInTab.get(`ow.chat.pending.${state}`) ?? '')).toMatchObject({ deviceId })
    })
})

describe('what a sign in is started with', () => {
    test('is another state and another device every time', async () => {
        const fake = fakeChatBrowser()
        const first = await start(fake, KARI)
        const second = await start(fake, KARI)

        expect(second.state).not.toBe(first.state)
        expect(second.deviceId).not.toBe(first.deviceId)
        expect(fake.keptInTab.size).toBe(2)
    })

    test('is drawn so that every letter is as likely as another', async () => {
        // 57 letters go into 256 four whole times, which leaves the bytes from 228: drawn as they
        // are they would make the first 28 letters likelier, so they are drawn again.
        const every = (byte: number) => <Bytes extends ArrayBufferView | null>(bytes: Bytes) => {
            if (bytes instanceof Uint8Array) bytes.fill(byte)
            return bytes
        }
        const drawn = jest.spyOn(crypto, 'getRandomValues')
            .mockImplementationOnce(every(255))
            .mockImplementationOnce(every(228))
            .mockImplementationOnce(every(227))
        try {
            const { deviceId } = await start(fakeChatBrowser(), KARI)
            expect(deviceId).toBe('9'.repeat(12))
        } finally {
            drawn.mockRestore()
        }
    })
})

describe('completing a sign in to the chat', () => {
    test('trades the code for tokens with what the sign in was started with, and keeps them', async () => {
        const fake = fakeChatBrowser()
        const { state, deviceId } = await start(fake, KARI)
        const { codeVerifier } = JSON.parse(fake.keptInTab.get(`ow.chat.pending.${state}`) ?? '') as { codeVerifier: string }
        const session = { userId: KARI, deviceId, accessToken: 'access-1', refreshToken: 'refresh-1' }

        await expect(completeSignIn(configFor(KARI), fake.browser, REDIRECT_URI, answerOf(state)))
            .resolves.toEqual({ signedIn: true, session })

        expect(Object.fromEntries(fake.callsTo(TOKEN)[0].form)).toEqual({
            grant_type: 'authorization_code',
            client_id: '000000000000000000MEGACHAT',
            code: 'the-code',
            code_verifier: codeVerifier,
            redirect_uri: REDIRECT_URI,
        })
        expect(readStoredSession(fake.browser)).toEqual(session)
    })

    test('takes a state once', async () => {
        const fake = fakeChatBrowser()
        const { state } = await start(fake, KARI)
        await completeSignIn(configFor(KARI), fake.browser, REDIRECT_URI, answerOf(state))

        await expect(completeSignIn(configFor(KARI), fake.browser, REDIRECT_URI, answerOf(state)))
            .resolves.toEqual({ signedIn: false, refusal: 'NOT_STARTED_HERE' })
        expect(fake.callsTo(TOKEN)).toHaveLength(1)
    })

    test('takes no answer to a sign in that was not started in this tab', async () => {
        const fake = fakeChatBrowser()
        await start(fake, KARI)

        await expect(completeSignIn(configFor(KARI), fake.browser, REDIRECT_URI, answerOf('another-state')))
            .resolves.toEqual({ signedIn: false, refusal: 'NOT_STARTED_HERE' })
        expect(fake.callsTo(TOKEN)).toHaveLength(0)
        expect(readStoredSession(fake.browser)).toBeNull()
    })

    test('keeps nothing when the chat\'s sign in refused, and the state is spent', async () => {
        const fake = fakeChatBrowser()
        const { state } = await start(fake, KARI)

        const refused = answerOf(state, { error: 'access_denied' })
        await expect(completeSignIn(configFor(KARI), fake.browser, REDIRECT_URI, refused))
            .resolves.toEqual({ signedIn: false, refusal: 'REFUSED' })
        expect(fake.callsTo(TOKEN)).toHaveLength(0)
        expect(fake.keptInTab.size).toBe(0)
        expect(readStoredSession(fake.browser)).toBeNull()
    })

    test('revokes the tokens of another user than the one signed in here, and keeps nothing of them', async () => {
        const fake = fakeChatBrowser()
        fake.chat.account = OLA
        await fake.makeDatabase('matrix-js-sdk:ow-chat-sync:@ola:chat.test')
        const { state } = await start(fake, KARI)

        await expect(completeSignIn(configFor(KARI), fake.browser, REDIRECT_URI, answerOf(state)))
            .resolves.toEqual({ signedIn: false, refusal: 'OTHER_ACCOUNT' })

        expect(fake.callsTo(REVOKE).map(call => Object.fromEntries(call.form))).toEqual([{
            token: 'refresh-1',
            token_type_hint: 'refresh_token',
            client_id: '000000000000000000MEGACHAT',
        }])
        expect(fake.kept.size).toBe(0)
        await expect(fake.databases()).resolves.toEqual([])
    })

    test('takes any account for another user\'s when the user has none here', async () => {
        const fake = fakeChatBrowser()
        const { state } = await start(fake, null)

        await expect(completeSignIn(configFor(null), fake.browser, REDIRECT_URI, answerOf(state)))
            .resolves.toEqual({ signedIn: false, refusal: 'OTHER_ACCOUNT' })
        expect(fake.callsTo(REVOKE)).toHaveLength(1)
        expect(fake.kept.size).toBe(0)
    })
})

describe('the device a browser is on the chat', () => {
    test('is the same for a user at their next sign in when only the tokens were lost', async () => {
        const fake = fakeChatBrowser()
        const first = await signIn(fake, KARI)
        fake.kept.delete('ow.chat.session')

        await expect(start(fake, KARI)).resolves.toMatchObject({ deviceId: first.deviceId })
    })

    test('is another for another user of the browser', async () => {
        const fake = fakeChatBrowser()
        const first = await signIn(fake, KARI)

        const { deviceId } = await start(fake, OLA)
        expect(deviceId).toHaveLength(12)
        expect(deviceId).not.toBe(first.deviceId)
    })

    test('is a new one for a user who has no account yet, and is kept as theirs once they have', async () => {
        const fake = fakeChatBrowser()
        const first = await signIn(fake, null)
        expect(first.result).toMatchObject({ signedIn: true, session: { userId: KARI, deviceId: first.deviceId } })
        fake.kept.delete('ow.chat.session')
        await expect(start(fake, KARI)).resolves.toMatchObject({ deviceId: first.deviceId })
    })

    test('is a new one after a sign out, which ends the session at the chat\'s sign in', async () => {
        const fake = fakeChatBrowser()
        const first = await signIn(fake, KARI)

        await signOut(configFor(KARI), fake.browser)

        expect(fake.callsTo(REVOKE).map(call => call.form.get('token'))).toEqual(['refresh-1'])
        expect(fake.kept.size).toBe(0)
        const { deviceId } = await start(fake, KARI)
        expect(deviceId).toHaveLength(12)
        expect(deviceId).not.toBe(first.deviceId)
    })
})

describe('signing out of the chat', () => {
    test('forgets the session also when the chat cannot be reached', async () => {
        const fake = fakeChatBrowser()
        await signIn(fake, KARI)
        fake.answer(REVOKE, () => 'UNREACHABLE')

        await expect(signOut(configFor(KARI), fake.browser)).rejects.toThrow()
        expect(fake.kept.size).toBe(0)
    })

    test('asks the chat nothing in a browser that has no session', async () => {
        const fake = fakeChatBrowser()
        await signOut(configFor(KARI), fake.browser)
        expect(fake.calls).toHaveLength(0)
    })
})
