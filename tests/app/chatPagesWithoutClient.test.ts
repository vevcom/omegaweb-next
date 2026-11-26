import { afterEach, beforeAll, describe, expect, test } from '@jest/globals'
import type { prisma as prismaClient } from '@/prisma-pn-client-instance'
import type { chatUserOperations as chatUserOperationsOfService } from '@/services/chat/users/operations'
import type { chatNavDef as chatNavDefOfPages } from '@/app/(omegaweb)/chat/chatNavDef'
import type { Session as SessionClass } from '@/auth/session/Session'
import type { UserFiltered } from '@/services/users/types'

type Loaded = {
    prisma: typeof prismaClient,
    chatUserOperations: typeof chatUserOperationsOfService,
    chatNavDef: typeof chatNavDefOfPages,
    Session: typeof SessionClass,
}
let loaded: Loaded

// The chat and its client are read from the environment when the pages are loaded, so they are set and unset first.
beforeAll(async () => {
    process.env.CHAT_AUTH_URL = 'https://account.chat.test'
    Reflect.deleteProperty(process.env, 'CHAT_CLIENT_URL')
    loaded = {
        prisma: (await import('@/prisma-pn-client-instance')).prisma,
        chatUserOperations: (await import('@/services/chat/users/operations')).chatUserOperations,
        chatNavDef: (await import('@/app/(omegaweb)/chat/chatNavDef')).chatNavDef,
        Session: (await import('@/auth/session/Session')).Session,
    }
})

afterEach(async () => {
    await loaded.prisma.user.deleteMany({ where: { email: { endsWith: '@chat-uten-klient.test' } } })
    await loaded.prisma.chatUser.deleteMany({ where: { userId: null } })
})

const viewer = { id: 0 } as UserFiltered

describe('without a chat client', () => {
    test('the chat pages are there, with nothing in their navigation to open it', async () => {
        const session = loaded.Session.fromJsObject({ user: viewer, permissions: [], memberships: [] })
        expect((await loaded.chatNavDef({ userId: viewer.id }).visible(session)).map(link => link.key))
            .toEqual(['messages', 'spaces', 'settings'])
    })

    test('a user on the chat can be written to, with nowhere to open the direct message', async () => {
        const { id: userId } = await loaded.prisma.user.create({
            data: {
                username: 'dm-uten-klient',
                email: 'dm-uten-klient@chat-uten-klient.test',
                firstname: 'Kari',
                lastname: 'Nordmann',
                bioParagraph: { create: {} },
                ledgerAccount: { create: { type: 'USER' } },
                chatUser: { create: { localpart: 'dm-uten-klient' } },
            },
        })
        const seesUsers = loaded.Session.fromJsObject({ user: viewer, permissions: ['USERS_USE'], memberships: [] })
        await expect(loaded.chatUserOperations.readDirectMessage({ params: { userId }, session: seesUsers }))
            .resolves.toMatchObject({ isOnChat: true, url: null })
    })
})
