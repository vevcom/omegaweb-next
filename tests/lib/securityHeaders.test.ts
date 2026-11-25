import { contentSecurityPolicy } from '@/lib/securityHeaders'
import { describe, expect, test } from '@jest/globals'

// The policy of a page that is no chat page, written out, so that a change to it shows here.
const PLAIN = [
    "default-src 'self'",
    "script-src 'self' 'nonce-abc' 'strict-dynamic' https://js.stripe.com https://*.js.stripe.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.stripe.com",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com",
    'frame-src https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com '
        + 'https://use.mazemap.com https://www.openstreetmap.org',
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
]
const PLAIN_IN_DEVELOPMENT = PLAIN
    .map(directive => (directive.startsWith('script-src') ? `${directive} 'unsafe-eval'` : directive))
    .map(directive => (directive.startsWith('connect-src') ? `${directive} ws:` : directive))

const chatPage = { origins: ['https://matrix.chat.test', 'https://account.chat.test'] }

describe('the content security policy', () => {
    test('of a page that is no chat page is what it was', () => {
        expect(contentSecurityPolicy('abc', { development: false })).toBe(PLAIN.join('; '))
        expect(contentSecurityPolicy('abc', { development: false, chatPage: null })).toBe(PLAIN.join('; '))
        expect(contentSecurityPolicy('abc', { development: true })).toBe(PLAIN_IN_DEVELOPMENT.join('; '))
    })

    test('of a chat page lets it fetch from the chat and compile WebAssembly, and nothing else', () => {
        const directives = (development: boolean) => contentSecurityPolicy('abc', { development, chatPage }).split('; ')
        const ownAndStripe = "connect-src 'self' https://api.stripe.com"
        const withTheChat = (directive: string) => (directive.startsWith('script-src')
            ? `${directive} 'wasm-unsafe-eval'`
            : directive.replace(ownAndStripe, `${ownAndStripe} https://matrix.chat.test https://account.chat.test`))

        expect(directives(false)).toEqual(PLAIN.map(withTheChat))
        expect(directives(true)).toEqual(PLAIN_IN_DEVELOPMENT.map(withTheChat))
    })
})
