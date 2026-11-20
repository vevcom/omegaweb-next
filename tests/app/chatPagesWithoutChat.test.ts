import { beforeAll, describe, expect, test } from '@jest/globals'
import type { chatNavDef as chatNavDefOfPages } from '@/app/(omegaweb)/chat/chatNavDef'
import type { authorizeChatPage as authorizeChatPageOfPages } from '@/app/(omegaweb)/chat/authorizeChatPage'
import type { navDef as navDefOfSite } from '@/components/NavBar/navDef'
import type { Session as SessionClass } from '@/auth/session/Session'
import type { UserFiltered } from '@/services/users/types'

type Loaded = {
    chatNavDef: typeof chatNavDefOfPages,
    authorizeChatPage: typeof authorizeChatPageOfPages,
    navDef: typeof navDefOfSite,
    Session: typeof SessionClass,
}
let loaded: Loaded

// Whether there is a chat is read from the environment when the pages are loaded, so it is unset first.
// The client is set, since it is not what decides.
beforeAll(async () => {
    Reflect.deleteProperty(process.env, 'CHAT_AUTH_URL')
    process.env.CHAT_CLIENT_URL = 'https://chat.test'
    loaded = {
        chatNavDef: (await import('@/app/(omegaweb)/chat/chatNavDef')).chatNavDef,
        authorizeChatPage: (await import('@/app/(omegaweb)/chat/authorizeChatPage')).authorizeChatPage,
        navDef: (await import('@/components/NavBar/navDef')).navDef,
        Session: (await import('@/auth/session/Session')).Session,
    }
})

describe('without a chat', () => {
    const user = () => loaded.Session.fromJsObject({ user: { id: 1 } as UserFiltered, permissions: [], memberships: [] })

    test('the chat pages are not found', () => {
        expect(() => loaded.authorizeChatPage(user())).toThrow(expect.objectContaining({
            digest: expect.stringContaining('404'),
        }))
    })

    test('nothing in the navigation leads to them', async () => {
        await expect(loaded.chatNavDef.visible(user())).resolves.toEqual([])
        expect((await loaded.navDef.visible(user())).map(link => link.key)).not.toContain('chat')
    })
})
