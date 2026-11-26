import { fakeChatBrowser } from 'tests/chatSessionBrowser'
import { prepareChatSignOut } from '@/components/Chat/Session/prepareChatSignOut'
import { readStoredSession, storeSession, takeSignOutRequest } from '@/lib/chatSession/storage'
import { afterEach, describe, expect, jest, test } from '@jest/globals'
import type { readChatSessionAction } from '@/services/chat/session/actions'
import type { ErrorCode } from '@/services/error'

const ofKari = { userId: '@kari:chat.test', deviceId: 'KARISDEVICE1', accessToken: 'access-0', refreshToken: 'refresh-0' }
const signsIn = {
    homeserverUrl: 'https://matrix.chat.test',
    clientId: '000000000000000000MEGACHAT',
    matrixUserId: ofKari.userId,
}

type Answer = Awaited<ReturnType<typeof readChatSessionAction>>
const refusal = (errorCode: ErrorCode): Answer => ({ success: false, errorCode, httpCode: 500 })

/** A browser that has kept a session, on the logout page, where asking the app of the chat's sign in gives `answer`. */
function onLogoutPage(answer: () => Promise<Answer>, { hasSession = true } = {}) {
    const fake = fakeChatBrowser()
    if (hasSession) storeSession(fake.browser, ofKari)
    const readChatSession = jest.fn<typeof readChatSessionAction>(answer)
    return {
        fake,
        readChatSession,
        prepare: (userId: number | null) => prepareChatSignOut(userId, { openBrowser: () => fake.browser, readChatSession }),
    }
}

afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window')
})

describe('logging out here in a browser that holds a session with the chat', () => {
    test('goes by the chat\'s sign-out page, which is asked to end the session', async () => {
        const { fake, readChatSession, prepare } = onLogoutPage(() => Promise.resolve({ success: true, data: signsIn }))

        await expect(prepare(7)).resolves.toBe(true)

        expect(readChatSession).toHaveBeenCalledWith({ params: { userId: 7 } })
        expect(readStoredSession(fake.browser)).toEqual(ofKari)
        expect(takeSignOutRequest(fake.browser)).toBe(true)
    })

    test.each<[string, () => Promise<Answer>]>([
        ['the chat pages sign nobody in', () => Promise.resolve(refusal('NOT FOUND'))],
        ['the user is no longer signed in', () => Promise.resolve(refusal('UNAUTHENTICATED'))],
        ['the user has no chat', () => Promise.resolve(refusal('UNAUTHORIZED'))],
        ['the app fails, as the sign-out page then would', () => Promise.resolve(refusal('SERVER ERROR'))],
        ['the app cannot be reached', () => Promise.reject(new TypeError('fetch failed'))],
    ])('forgets the session and goes by no chat page when %s', async (_, answer) => {
        const { fake, prepare } = onLogoutPage(answer)

        await expect(prepare(7)).resolves.toBe(false)

        expect(fake.kept.size).toBe(0)
        expect(takeSignOutRequest(fake.browser)).toBe(false)
    })

    test('forgets the session without asking when nobody is signed in here any more', async () => {
        const { fake, readChatSession, prepare } = onLogoutPage(() => Promise.resolve({ success: true, data: signsIn }))

        await expect(prepare(null)).resolves.toBe(false)

        expect(readChatSession).not.toHaveBeenCalled()
        expect(fake.kept.size).toBe(0)
    })
})

describe('logging out here in a browser that holds no session with the chat', () => {
    test('asks nothing and goes by no chat page', async () => {
        const { readChatSession, prepare } = onLogoutPage(() => Promise.resolve({ success: true, data: signsIn }), {
            hasSession: false,
        })

        await expect(prepare(7)).resolves.toBe(false)
        expect(readChatSession).not.toHaveBeenCalled()
    })

    test('goes on when the site\'s storage is blocked, which is to hold none', async () => {
        const readChatSession = jest.fn<typeof readChatSessionAction>()
        Reflect.defineProperty(globalThis, 'window', {
            configurable: true,
            value: {
                get localStorage(): Storage {
                    throw new DOMException('The operation is insecure.', 'SecurityError')
                },
            },
        })

        await expect(prepareChatSignOut(7, { readChatSession })).resolves.toBe(false)
        expect(readChatSession).not.toHaveBeenCalled()
    })

    test('goes on when the storage is there and cannot be read', async () => {
        const { fake, prepare } = onLogoutPage(() => Promise.resolve({ success: true, data: signsIn }))
        fake.browser.kept.getItem = () => {
            throw new DOMException('The operation is insecure.', 'SecurityError')
        }

        await expect(prepare(7)).resolves.toBe(false)
    })
})
