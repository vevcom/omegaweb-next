import { configFor, fakeChatBrowser, tameChatSdk } from 'tests/chatSessionBrowser'
import { chatClientOf } from '@/lib/chatSession/client'
import { readStoredSession, storeSession } from '@/lib/chatSession/storage'
import { beforeAll, describe, expect, jest, test } from '@jest/globals'

const KARI = '@kari:chat.test'
const WHOAMI = '/_matrix/client/v3/account/whoami'
const kept = { userId: KARI, deviceId: 'KARISDEVICE1', accessToken: 'access-0', refreshToken: 'refresh-0' }

beforeAll(() => tameChatSdk(jest.spyOn))

/** A browser that has kept a session whose access token has run out, which the homeserver says of that token alone. */
function browserWithAnOldToken() {
    const fake = fakeChatBrowser()
    storeSession(fake.browser, kept)
    fake.answer(WHOAMI, call => (call.token === 'Bearer access-0'
        ? { status: 401, body: { errcode: 'M_UNKNOWN_TOKEN', error: 'Token expired' } }
        : { body: { user_id: KARI } }))
    return fake
}

describe('the client of a kept session', () => {
    test('trades the refresh token for new tokens when the access token has run out, and keeps the new ones', async () => {
        const fake = browserWithAnOldToken()
        const client = await chatClientOf(configFor(KARI), fake.browser, kept)

        await expect(client.whoami()).resolves.toEqual({ user_id: KARI })

        expect(fake.callsTo('/oauth2/token').map(call => Object.fromEntries(call.form))).toEqual([{
            grant_type: 'refresh_token',
            client_id: '000000000000000000MEGACHAT',
            refresh_token: 'refresh-0',
        }])
        expect(fake.callsTo(WHOAMI).map(call => call.token)).toEqual(['Bearer access-0', 'Bearer access-1'])
        expect(readStoredSession(fake.browser)).toEqual({ ...kept, accessToken: 'access-1', refreshToken: 'refresh-1' })
    })

    test('does not write its new tokens over a session that is no longer the one it is of', async () => {
        const fake = browserWithAnOldToken()
        const client = await chatClientOf(configFor(KARI), fake.browser, kept)
        const ofOla = { userId: '@ola:chat.test', deviceId: 'OLASDEVICE12', accessToken: 'olas', refreshToken: 'olas-0' }
        storeSession(fake.browser, ofOla)

        await client.whoami()

        expect(readStoredSession(fake.browser)).toEqual(ofOla)
    })
})
