import { testDomainConfig } from 'tests/testDomains'
import { DomainConfig } from '@/lib/sites/domainConfig'
import { DomainContext } from '@/lib/sites/context'
import { contentSecurityPolicy } from '@/lib/securityHeaders'
import { afterEach, describe, expect, jest, test } from '@jest/globals'
import { NextRequest } from 'next/server'

const CHAT = {
    CHAT_AUTH_URL: 'https://account.chat.test',
    CHAT_HOMESERVER_PUBLIC_URL: 'https://matrix.chat.test',
    CHAT_SERVER_NAME: 'chat.test',
}

/**
 * The policy the proxy gives the page at `url`, with the nonce taken out. The chat is read from the
 * environment when the proxy is loaded, so it is loaded anew with the environment given.
 */
async function policyOf(url: string, environment: Partial<typeof CHAT> = CHAT) {
    for (const name of Object.keys(CHAT)) Reflect.deleteProperty(process.env, name)
    Object.assign(process.env, environment)
    let policy: string | null = null
    await jest.isolateModulesAsync(async () => {
        const { proxy } = await import('@/proxy')
        const response = proxy(new NextRequest(url, { headers: { host: new URL(url).host } }))
        policy = response.headers.get('Content-Security-Policy')
    })
    return (policy ?? '').replace(/'nonce-[^']+'/, "'nonce-abc'")
}

const plain = contentSecurityPolicy('abc', { development: false })
const ofChatPage = contentSecurityPolicy('abc', {
    development: false,
    chatPage: { origins: ['https://matrix.chat.test', 'https://account.chat.test'] },
})

afterEach(() => DomainContext.configure(testDomainConfig))

describe('the content security policy the proxy gives', () => {
    test('a chat page lets it reach the homeserver and its sign in', async () => {
        for (const path of ['/chat', '/chat/', '/chat/settings', '/chat/sign-in', '/chat/messages/kari', '/chat?fra=meny']) {
            await expect(policyOf(`https://omega.ntnu.no${path}`)).resolves.toBe(ofChatPage)
        }
    })

    test('every other page is the one it was', async () => {
        const others = [
            '/', '/chatter', '/chat-spaces', '/users/kari/chat', '/admin/chat-spaces', '/career/chat',
            '/api/chat/appservice/ping',
        ]
        for (const path of others) {
            await expect(policyOf(`https://omega.ntnu.no${path}`)).resolves.toBe(plain)
        }
    })

    test('a chat page is the one it was where the chat pages sign nobody in', async () => {
        for (const missing of Object.keys(CHAT)) {
            const rest = Object.fromEntries(Object.entries(CHAT).filter(([name]) => name !== missing))
            await expect(policyOf('https://omega.ntnu.no/chat', rest)).resolves.toBe(plain)
        }
    })

    test('a path under /chat is the one it was on a domain that serves no chat page', async () => {
        DomainContext.configure(DomainConfig.parse({
            'omega.ntnu.no': { site: 'OMEGAWEB', main: true },
            'contactor.no': { site: 'CAREERS', main: true },
            'login.omega.ntnu.no': { auth: true },
        }))
        await expect(policyOf('https://omega.ntnu.no/chat')).resolves.toBe(ofChatPage)
        await expect(policyOf('https://contactor.no/chat')).resolves.toBe(plain)
        await expect(policyOf('https://login.omega.ntnu.no/chat')).resolves.toBe(plain)
    })
})
