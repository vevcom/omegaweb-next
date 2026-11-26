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

// Where the chat pages sign in is read from the environment when the service is loaded, so it is set first.
beforeAll(async () => {
    process.env.CHAT_AUTH_URL = 'https://account.chat.test'
    process.env.CHAT_HOMESERVER_PUBLIC_URL = 'https://matrix.chat.test/'
    process.env.CHAT_SERVER_NAME = 'chat.test'
    loaded = {
        prisma: (await import('@/prisma-pn-client-instance')).prisma,
        chatSessionOperations: (await import('@/services/chat/session/operations')).chatSessionOperations,
        userOperations: (await import('@/services/users/operations')).userOperations,
        Session: (await import('@/auth/session/Session')).Session,
    }
})

afterEach(async () => {
    await loaded.prisma.user.deleteMany({ where: { email: { endsWith: '@chat-session.test' } } })
    await loaded.prisma.chatUser.deleteMany({ where: { userId: null } })
})

async function createUser(username: string, localpart?: string) {
    const created = await loaded.prisma.user.create({
        data: {
            username,
            email: `${username}@chat-session.test`,
            firstname: 'Kari',
            lastname: 'Nordmann',
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
            chatUser: localpart ? { create: { localpart } } : undefined,
        },
    })
    const user = await loaded.userOperations.read({ params: { id: created.id }, bypassAuth: true })
    return { user, session: loaded.Session.fromJsObject({ user, permissions: [], memberships: [] }) }
}

describe('what a browser signs in to the chat with', () => {
    test('is the homeserver as browsers reach it, the client of the chat pages and the user\'s Matrix id', async () => {
        const { user, session } = await createUser('chat-okt-kari', 'kari')
        await expect(loaded.chatSessionOperations.read({ params: { userId: user.id }, session })).resolves.toEqual({
            homeserverUrl: 'https://matrix.chat.test',
            clientId: '000000000000000000MEGACHAT',
            matrixUserId: '@kari:chat.test',
        })
    })

    test('has no Matrix id for a user who has no account on the chat yet', async () => {
        const { user, session } = await createUser('chat-okt-ny')
        await expect(loaded.chatSessionOperations.read({ params: { userId: user.id }, session }))
            .resolves.toMatchObject({ matrixUserId: null })
    })

    test('is read by the user alone, and not by a user admin', async () => {
        const { user } = await createUser('chat-okt-eier', 'eier')
        const other = await createUser('chat-okt-annen', 'annen')
        const admin = loaded.Session.fromJsObject({ user: other.user, permissions: ['USERS_ADMIN'], memberships: [] })

        for (const session of [other.session, admin]) {
            await expect(loaded.chatSessionOperations.read({ params: { userId: user.id }, session }))
                .rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
        }
        await expect(loaded.chatSessionOperations.read({ params: { userId: user.id }, session: loaded.Session.empty() }))
            .rejects.toMatchObject({ errorCode: 'UNAUTHENTICATED' })
    })
})
