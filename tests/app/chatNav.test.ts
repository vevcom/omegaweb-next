import { chatLinks } from '@/app/(omegaweb)/chat/links'
import { externalHref } from '@/lib/sites/href'
import { beforeAll, describe, expect, jest, test } from '@jest/globals'
import type useActiveNavHref from '@/hooks/useActiveNavHref'

const pathname = jest.fn<() => string>()
let activeNavHref: typeof useActiveNavHref

// The hook reads the path from Next's router, which a test has none of, so it is stood in for before the hook is loaded.
beforeAll(async () => {
    jest.doMock('next/navigation', () => ({ usePathname: pathname }))
    activeNavHref = (await import('@/hooks/useActiveNavHref')).default
})

const hrefs = [chatLinks.messages(), chatLinks.spaces(), chatLinks.settings(), externalHref('https://chat.test')]

function activeOn(path: string) {
    pathname.mockReturnValue(path)
    return activeNavHref(hrefs)
}

describe('the active item of the chat pages\' navigation', () => {
    test('is the page\'s own, and not the messages every page is under', () => {
        expect(activeOn('/chat')).toBe(chatLinks.messages())
        expect(activeOn('/chat/spaces')).toBe(chatLinks.spaces())
        expect(activeOn('/chat/settings')).toBe(chatLinks.settings())
    })

    test('is the messages on a direct message, whatever the user is called', () => {
        expect(activeOn(chatLinks.directMessage({ username: 'kari' }))).toBe(chatLinks.messages())
        expect(activeOn(chatLinks.directMessage({ username: 'spaces' }))).toBe(chatLinks.messages())
        expect(activeOn(chatLinks.directMessage({ username: 'settings' }))).toBe(chatLinks.messages())
    })

    test('is never the chat client, which is no page', () => {
        ['/chat', '/chat/spaces', '/chat/settings'].forEach(path => expect(activeOn(path)).not.toBe('https://chat.test'))
    })
})
