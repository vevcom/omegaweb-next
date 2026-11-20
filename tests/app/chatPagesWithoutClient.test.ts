import { beforeAll, describe, expect, test } from '@jest/globals'
import type { chatNavDef as chatNavDefOfPages } from '@/app/(omegaweb)/chat/chatNavDef'
import type { Session as SessionClass } from '@/auth/session/Session'
import type { UserFiltered } from '@/services/users/types'

type Loaded = {
    chatNavDef: typeof chatNavDefOfPages,
    Session: typeof SessionClass,
}
let loaded: Loaded

// The chat and its client are read from the environment when the pages are loaded, so they are set and unset first.
beforeAll(async () => {
    process.env.CHAT_AUTH_URL = 'https://account.chat.test'
    Reflect.deleteProperty(process.env, 'CHAT_CLIENT_URL')
    loaded = {
        chatNavDef: (await import('@/app/(omegaweb)/chat/chatNavDef')).chatNavDef,
        Session: (await import('@/auth/session/Session')).Session,
    }
})

const viewer = { id: 0 } as UserFiltered

describe('without a chat client', () => {
    test('the chat pages are there, with nothing in their navigation to open it', async () => {
        const session = loaded.Session.fromJsObject({ user: viewer, permissions: [], memberships: [] })
        expect((await loaded.chatNavDef.visible(session)).map(link => link.key)).toEqual(['messages', 'spaces', 'settings'])
    })
})
