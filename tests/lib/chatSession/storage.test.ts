import { configFor, fakeChatBrowser, tameChatSdk } from 'tests/chatSessionBrowser'
import { signOut } from '@/lib/chatSession/client'
import {
    forgetSession,
    readDeviceId,
    readStoredSession,
    requestSignOut,
    storeSession,
    takeSignOutRequest,
} from '@/lib/chatSession/storage'
import { beforeAll, describe, expect, jest, test } from '@jest/globals'

const ofKari = { userId: '@kari:chat.test', deviceId: 'KARISDEVICE1', accessToken: 'access-0', refreshToken: 'refresh-0' }

beforeAll(() => tameChatSdk(jest.spyOn))

describe('forgetting the session', () => {
    test('forgets the tokens and the device', async () => {
        const fake = fakeChatBrowser()
        storeSession(fake.browser, ofKari)
        expect(readDeviceId(fake.browser, ofKari.userId)).toBe('KARISDEVICE1')

        await forgetSession(fake.browser)

        expect(readStoredSession(fake.browser)).toBeNull()
        expect(fake.kept.size).toBe(0)
    })

    test('deletes what every user has synced, and no other database of the site', async () => {
        const fake = fakeChatBrowser()
        storeSession(fake.browser, ofKari)
        await fake.makeDatabase('matrix-js-sdk:ow-chat-sync:@kari:chat.test')
        await fake.makeDatabase('matrix-js-sdk:ow-chat-sync:@ola:chat.test')
        await fake.makeDatabase('something-else')

        await forgetSession(fake.browser)

        await expect(fake.databases()).resolves.toEqual(['something-else'])
    })

    test('forgets the tokens before the databases are gone, and in a browser that has none', async () => {
        const fake = fakeChatBrowser()
        storeSession(fake.browser, ofKari)
        const forgetting = forgetSession(fake.browser)
        expect(fake.kept.size).toBe(0)
        await forgetting

        const withoutDatabases = { ...fake.browser, indexedDB: undefined }
        storeSession(withoutDatabases, ofKari)
        await forgetSession(withoutDatabases)
        expect(fake.kept.size).toBe(0)
    })
})

describe('signing out in a browser that will not say which databases it has', () => {
    test('still forgets the session and ends it at the chat\'s sign in', async () => {
        const fake = fakeChatBrowser()
        storeSession(fake.browser, ofKari)
        const refusing = { databases: () => Promise.reject(new DOMException('No access', 'InvalidStateError')) }
        const browser = { ...fake.browser, indexedDB: refusing as unknown as IDBFactory }

        await signOut(configFor(ofKari.userId), browser)

        expect(fake.kept.size).toBe(0)
        expect(fake.callsTo('/oauth2/revoke').map(call => call.form.get('token'))).toEqual(['refresh-0'])
    })
})

describe('a sign out asked for by the logout page', () => {
    test('is taken once, in the tab it was asked for in', () => {
        const fake = fakeChatBrowser()
        const otherTab = fake.openTab()
        expect(takeSignOutRequest(fake.browser)).toBe(false)

        requestSignOut(fake.browser)

        expect(takeSignOutRequest(otherTab)).toBe(false)
        expect(takeSignOutRequest(fake.browser)).toBe(true)
        expect(takeSignOutRequest(fake.browser)).toBe(false)
    })
})
