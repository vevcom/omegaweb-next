import { afterEach, beforeAll, describe, expect, test } from '@jest/globals'
import type { prisma as prismaClient } from '@/prisma-pn-client-instance'
import type { chatSessionOperations as chatSessionOperationsOfService } from '@/services/chat/session/operations'
import type { userOperations as userOperationsOfService } from '@/services/users/operations'
import type { Session as SessionClass } from '@/auth/session/Session'

type Loaded = {
    prisma: typeof prismaClient,
    chatSessionOperations: typeof chatSessionOperationsOfService,
    userOperations: typeof userOperationsOfService,
    Session: typeof SessionClass,
}
let loaded: Loaded

// Where the chat pages sign in is read from the environment when the service is loaded. The chat
// is set and the homeserver as browsers reach it unset, since the chat pages are there without it.
beforeAll(async () => {
    process.env.CHAT_AUTH_URL = 'https://account.chat.test'
    process.env.CHAT_SERVER_NAME = 'chat.test'
    Reflect.deleteProperty(process.env, 'CHAT_HOMESERVER_PUBLIC_URL')
    loaded = {
        prisma: (await import('@/prisma-pn-client-instance')).prisma,
        chatSessionOperations: (await import('@/services/chat/session/operations')).chatSessionOperations,
        userOperations: (await import('@/services/users/operations')).userOperations,
        Session: (await import('@/auth/session/Session')).Session,
    }
})

afterEach(async () => {
    await loaded.prisma.user.deleteMany({ where: { email: { endsWith: '@chat-uten-okt.test' } } })
    await loaded.prisma.chatUser.deleteMany({ where: { userId: null } })
})

describe('without the homeserver as browsers reach it', () => {
    test('there is nothing to sign a browser in to the chat with, also for a user on the chat', async () => {
        const created = await loaded.prisma.user.create({
            data: {
                username: 'chat-uten-okt',
                email: 'chat-uten-okt@chat-uten-okt.test',
                firstname: 'Kari',
                lastname: 'Nordmann',
                bioParagraph: { create: {} },
                ledgerAccount: { create: { type: 'USER' } },
                chatUser: { create: { localpart: 'chat-uten-okt' } },
            },
        })
        const user = await loaded.userOperations.read({ params: { id: created.id }, bypassAuth: true })
        const session = loaded.Session.fromJsObject({ user, permissions: [], memberships: [] })
        await expect(loaded.chatSessionOperations.read({ params: { userId: user.id }, session }))
            .rejects.toMatchObject({ errorCode: 'NOT FOUND' })
    })
})
