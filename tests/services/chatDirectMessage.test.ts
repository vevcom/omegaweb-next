import { beforeAll, afterEach, describe, expect, test } from '@jest/globals'
import type { prisma as prismaClient } from '@/prisma-pn-client-instance'
import type { chatUserOperations as chatUserOperationsOfService } from '@/services/chat/users/operations'
import type { Session as SessionClass, SessionMaybeUser } from '@/auth/session/Session'
import type { UserFiltered } from '@/services/users/types'

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

type Made = { localpart?: string, firstname?: string }

async function createUser(username: string, { localpart, firstname = 'Kari' }: Made = {}) {
    return loaded.prisma.user.create({
        data: {
            username,
            email: `${username}@chat-dm-test.test`,
            firstname,
            lastname: 'Nordmann',
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
            chatUser: localpart ? { create: { localpart } } : undefined,
        },
    })
}

const viewer = { id: 0 } as UserFiltered
const seesUsers = () => loaded.Session.fromJsObject({ user: viewer, permissions: ['USERS_USE'], memberships: [] })

describe('the direct message with a user', () => {
    test('opens in the chat client by their Matrix id', async () => {
        const { id: userId } = await createUser('dm-kari', { localpart: 'dm-kari' })
        await expect(loaded.chatUserOperations.readDirectMessage({ params: { userId }, session: seesUsers() }))
            .resolves.toEqual({
                isOnChat: true,
                matrixUserId: '@dm-kari:chat.test',
                url: 'https://chat.test/#/user/@dm-kari:chat.test?action=chat',
            })
    })

    test('has no Matrix id and no url for a user who is not on the chat', async () => {
        const { id: userId } = await createUser('dm-uten')
        await expect(loaded.chatUserOperations.readDirectMessage({ params: { userId }, session: seesUsers() }))
            .resolves.toEqual({ isOnChat: false, matrixUserId: null, url: null })
    })

    test('has no Matrix id and no url for a user whose account is deactivated', async () => {
        const { id: userId } = await createUser('dm-borte', { localpart: 'dm-borte' })
        await loaded.prisma.chatUser.update({ where: { userId }, data: { deactivatedAt: new Date() } })
        await expect(loaded.chatUserOperations.readDirectMessage({ params: { userId }, session: seesUsers() }))
            .resolves.toEqual({ isOnChat: false, matrixUserId: null, url: null })
    })

    test('is for the users who see the users', async () => {
        const { id: userId } = await createUser('dm-lukket', { localpart: 'dm-lukket' })
        const readAs = (session: SessionMaybeUser) =>
            loaded.chatUserOperations.readDirectMessage({ params: { userId }, session })
        await expect(readAs(loaded.Session.empty())).rejects.toMatchObject({ errorCode: 'UNAUTHENTICATED' })
        await expect(readAs(loaded.Session.fromJsObject({ user: viewer, permissions: [], memberships: [] })))
            .rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
        // Nobody on the chat is without a user, whatever permissions the session holds.
        await expect(readAs(loaded.Session.fromJsObject({ user: null, permissions: ['USERS_USE'], memberships: [] })))
            .rejects.toMatchObject({ errorCode: 'UNAUTHENTICATED' })
    })
})

describe('who the accounts on the chat are', () => {
    test('is the user of each by name, for the accounts here of users who are not archived', async () => {
        await createUser('hvem-kari', { localpart: 'hvem-kari' })
        await createUser('hvem-ola', { localpart: 'hvem-ola-2', firstname: 'Ola' })
        await createUser('hvem-per', { localpart: 'hvem-per', firstname: 'Per' })
        const { id: goneUserId } = await createUser('hvem-borte', { localpart: 'hvem-borte' })
        await loaded.prisma.chatUser.update({ where: { userId: goneUserId }, data: { deactivatedAt: new Date() } })
        await loaded.prisma.chatUser.create({ data: { localpart: 'hvem-uten-bruker' } })
        const { id: archivedUserId } = await createUser('hvem-arkivert', { localpart: 'hvem-arkivert' })
        await loaded.prisma.user.update({ where: { id: archivedUserId }, data: { archived: true } })

        const profiles = await loaded.chatUserOperations.readProfiles({
            params: {
                matrixUserIds: [
                    '@hvem-ola-2:chat.test',
                    '@hvem-kari:chat.test',
                    // Of another homeserver, whose name is as long as this one's, and no Matrix id at all.
                    '@hvem-per:chat.tesu',
                    'xhvem-per:chat.test',
                    '@hvem-borte:chat.test',
                    '@hvem-uten-bruker:chat.test',
                    '@hvem-arkivert:chat.test',
                    '@nobody:chat.test',
                ],
            },
            session: seesUsers(),
        })

        const named = { lastname: 'Nordmann', image: null }
        expect(profiles.toSorted((one, other) => one.matrixUserId.localeCompare(other.matrixUserId))).toEqual([
            { matrixUserId: '@hvem-kari:chat.test', firstname: 'Kari', ...named },
            { matrixUserId: '@hvem-ola-2:chat.test', firstname: 'Ola', ...named },
        ])
    })

    test('is for the users who see the users', async () => {
        await createUser('hvem-lukket', { localpart: 'hvem-lukket' })
        const readAs = (session: SessionMaybeUser) =>
            loaded.chatUserOperations.readProfiles({ params: { matrixUserIds: ['@hvem-lukket:chat.test'] }, session })
        await expect(readAs(loaded.Session.empty())).rejects.toMatchObject({ errorCode: 'UNAUTHENTICATED' })
        await expect(readAs(loaded.Session.fromJsObject({ user: viewer, permissions: [], memberships: [] })))
            .rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
        await expect(readAs(loaded.Session.fromJsObject({ user: null, permissions: ['USERS_USE'], memberships: [] })))
            .rejects.toMatchObject({ errorCode: 'UNAUTHENTICATED' })
    })

    test('is asked of a hundred accounts at most at once', async () => {
        const matrixUserIds = Array.from({ length: 101 }, (_, index) => `@hvem-${index}:chat.test`)
        await expect(loaded.chatUserOperations.readProfiles({ params: { matrixUserIds }, session: seesUsers() }))
            .rejects.toMatchObject({ errorCode: 'BAD PARAMETERS' })
    })
})
