import { beforeAll, afterEach, describe, expect, test } from '@jest/globals'
import type { prisma as prismaClient } from '@/prisma-pn-client-instance'
import type { chatUserOperations as chatUserOperationsOfService } from '@/services/chat/users/operations'
import type { Session as SessionClass } from '@/auth/session/Session'

type Loaded = {
    prisma: typeof prismaClient,
    chatUserOperations: typeof chatUserOperationsOfService,
    Session: typeof SessionClass,
}
let loaded: Loaded

// The client and the server name are read from the environment when the service is loaded, so they are set first.
beforeAll(async () => {
    process.env.CHAT_CLIENT_URL = 'https://chat.test'
    process.env.CHAT_SERVER_NAME = 'chat.test'
    loaded = {
        prisma: (await import('@/prisma-pn-client-instance')).prisma,
        chatUserOperations: (await import('@/services/chat/users/operations')).chatUserOperations,
        Session: (await import('@/auth/session/Session')).Session,
    }
})

afterEach(async () => {
    await loaded.prisma.user.deleteMany({ where: { email: { endsWith: '@chat-dm-test.test' } } })
    await loaded.prisma.chatUser.deleteMany({ where: { userId: null } })
})

async function createUser(username: string, { localpart }: { localpart?: string } = {}) {
    return loaded.prisma.user.create({
        data: {
            username,
            email: `${username}@chat-dm-test.test`,
            firstname: 'Kari',
            lastname: 'Nordmann',
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
            chatUser: localpart ? { create: { localpart } } : undefined,
        },
    })
}

const seesUsers = () => loaded.Session.fromJsObject({ user: null, permissions: ['USERS_USE'], memberships: [] })

describe('the direct message with a user', () => {
    test('opens in the chat client by their Matrix id', async () => {
        const { id: userId } = await createUser('dm-kari', { localpart: 'dm-kari' })
        await expect(loaded.chatUserOperations.readDirectMessage({ params: { userId }, session: seesUsers() }))
            .resolves.toEqual({ chatIsSetUp: true, url: 'https://chat.test/#/user/@dm-kari:chat.test?action=chat' })
    })

    test('has no url for a user who is not on the chat', async () => {
        const { id: userId } = await createUser('dm-uten')
        await expect(loaded.chatUserOperations.readDirectMessage({ params: { userId }, session: seesUsers() }))
            .resolves.toEqual({ chatIsSetUp: true, url: null })
    })

    test('has no url for a user whose account is deactivated', async () => {
        const { id: userId } = await createUser('dm-borte', { localpart: 'dm-borte' })
        await loaded.prisma.chatUser.update({ where: { userId }, data: { deactivatedAt: new Date() } })
        await expect(loaded.chatUserOperations.readDirectMessage({ params: { userId }, session: seesUsers() }))
            .resolves.toEqual({ chatIsSetUp: true, url: null })
    })

    test('is for those who see the users', async () => {
        const { id: userId } = await createUser('dm-lukket', { localpart: 'dm-lukket' })
        await expect(loaded.chatUserOperations.readDirectMessage({ params: { userId }, session: loaded.Session.empty() }))
            .rejects.toMatchObject({ errorCode: 'UNAUTHENTICATED' })
    })
})
