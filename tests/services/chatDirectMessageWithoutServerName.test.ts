import { afterEach, beforeAll, describe, expect, test } from '@jest/globals'
import type { prisma as prismaClient } from '@/prisma-pn-client-instance'
import type { chatUserOperations as chatUserOperationsOfService } from '@/services/chat/users/operations'
import type { Session as SessionClass } from '@/auth/session/Session'
import type { UserFiltered } from '@/services/users/types'

type Loaded = {
    prisma: typeof prismaClient,
    chatUserOperations: typeof chatUserOperationsOfService,
    Session: typeof SessionClass,
}
let loaded: Loaded

// The client and the server name are read from the environment when the service is loaded, so they are set and unset first.
beforeAll(async () => {
    process.env.CHAT_CLIENT_URL = 'https://chat.test'
    Reflect.deleteProperty(process.env, 'CHAT_SERVER_NAME')
    loaded = {
        prisma: (await import('@/prisma-pn-client-instance')).prisma,
        chatUserOperations: (await import('@/services/chat/users/operations')).chatUserOperations,
        Session: (await import('@/auth/session/Session')).Session,
    }
})

afterEach(async () => {
    await loaded.prisma.user.deleteMany({ where: { email: { endsWith: '@chat-uten-servernavn.test' } } })
    await loaded.prisma.chatUser.deleteMany({ where: { userId: null } })
})

describe('the direct message with a user, without the server name', () => {
    test('has no url, since a Matrix id cannot be made, also for a user on the chat', async () => {
        const { id: userId } = await loaded.prisma.user.create({
            data: {
                username: 'dm-uten-servernavn',
                email: 'dm-uten-servernavn@chat-uten-servernavn.test',
                firstname: 'Kari',
                lastname: 'Nordmann',
                bioParagraph: { create: {} },
                ledgerAccount: { create: { type: 'USER' } },
                chatUser: { create: { localpart: 'dm-uten-servernavn' } },
            },
        })
        const viewer = { id: 0 } as UserFiltered
        const seesUsers = loaded.Session.fromJsObject({ user: viewer, permissions: ['USERS_USE'], memberships: [] })
        await expect(loaded.chatUserOperations.readDirectMessage({ params: { userId }, session: seesUsers }))
            .resolves.toEqual({ isOnChat: true, matrixUserId: null, url: null })
    })
})
