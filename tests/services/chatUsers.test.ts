import { createChatSpace } from 'tests/chatSpaces'
import { chatUserOperations } from '@/services/chat/users/operations'
import { chatLocalpartAt, chatLocalpartOf } from '@/services/chat/users/localpart'
import { userOperations } from '@/services/users/operations'
import { prisma } from '@/prisma-pn-client-instance'
import { Session } from '@/auth/session/Session'
import { afterEach, describe, expect, test } from '@jest/globals'

async function createUser(username: string) {
    const created = await prisma.user.create({
        data: {
            username,
            email: `${username}@chat-test.test`,
            firstname: 'Kari',
            lastname: 'Nordmann',
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
    })
    const user = await userOperations.read({ params: { id: created.id }, bypassAuth: true })
    return { user, session: Session.fromJsObject({ user, permissions: [], memberships: [] }) }
}

afterEach(async () => {
    await prisma.chatSpace.deleteMany()
    await prisma.user.deleteMany({ where: { email: { endsWith: '@chat-test.test' } } })
    // The account of a deleted user stays, without the user.
    await prisma.chatUser.deleteMany({ where: { userId: null } })
})

describe('the localpart of a chat user', () => {
    test('is the username as a Matrix id takes it', () => {
        expect(chatLocalpartOf({ id: 1, username: 'kari.nordmann' })).toBe('kari.nordmann')
        expect(chatLocalpartOf({ id: 1, username: 'Bjørn Åse Sæther' })).toBe('bjoernaasesaether')
        expect(chatLocalpartOf({ id: 1, username: 'andré_42' })).toBe('andre_42')
        expect(chatLocalpartOf({ id: 1, username: '-kari-' })).toBe('kari')
    })

    test('is the id for a username that leaves nothing', () => {
        expect(chatLocalpartOf({ id: 7, username: '!!' })).toBe('bruker7')
    })

    test('gets a number after it, from 2, when it is tried again', () => {
        expect(chatLocalpartAt({ id: 1, username: 'kari' }, 0)).toBe('kari')
        expect(chatLocalpartAt({ id: 1, username: 'kari' }, 1)).toBe('kari2')
    })
})

describe('opting in to the chat', () => {
    test('gives a user an account with their username as its localpart', async () => {
        const { user, session } = await createUser('chat-kari')
        await expect(chatUserOperations.optIn({ params: { userId: user.id }, session }))
            .resolves.toMatchObject({ userId: user.id, localpart: 'chat-kari' })
    })

    test('keeps the account a user has, also when their username has changed since', async () => {
        const { user, session } = await createUser('chat-ola')
        const first = await chatUserOperations.optIn({ params: { userId: user.id }, session })
        await prisma.user.update({ where: { id: user.id }, data: { username: 'chat-ola-ny' } })
        await expect(chatUserOperations.optIn({ params: { userId: user.id }, session })).resolves.toEqual(first)
        await expect(prisma.chatUser.count({ where: { userId: user.id } })).resolves.toBe(1)
    })

    test('gives the one account to a user who signs in twice at once', async () => {
        const { user, session } = await createUser('chat-samtidig')
        const [first, second] = await Promise.all([
            chatUserOperations.optIn({ params: { userId: user.id }, session }),
            chatUserOperations.optIn({ params: { userId: user.id }, session }),
        ])
        expect(second).toEqual(first)
    })

    test('puts a number after a localpart another user has', async () => {
        const first = await createUser('chat-åse')
        const second = await createUser('chat-aase')
        await chatUserOperations.optIn({ params: { userId: first.user.id }, session: first.session })
        await expect(chatUserOperations.optIn({ params: { userId: second.user.id }, session: second.session }))
            .resolves.toMatchObject({ localpart: 'chat-aase2' })
    })

    test('gives no user a localpart the application has itself', async () => {
        const { user, session } = await createUser('Omegaweb')
        await expect(chatUserOperations.optIn({ params: { userId: user.id }, session }))
            .resolves.toMatchObject({ localpart: 'omegaweb2' })
    })

    test('is the user\'s own to do', async () => {
        const kari = await createUser('chat-eier')
        const other = await createUser('chat-annen')
        await expect(chatUserOperations.optIn({ params: { userId: kari.user.id }, session: other.session }))
            .rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
        await expect(chatUserOperations.optIn({ params: { userId: kari.user.id }, session: Session.empty() }))
            .rejects.toMatchObject({ errorCode: 'UNAUTHENTICATED' })
    })

    test('stays when the user is deleted, so their localpart is given to no one after them', async () => {
        const deleted = await createUser('chat-slettes')
        await chatUserOperations.optIn({ params: { userId: deleted.user.id }, session: deleted.session })
        await prisma.user.delete({ where: { id: deleted.user.id } })
        await expect(prisma.chatUser.findUniqueOrThrow({ where: { localpart: 'chat-slettes' } }))
            .resolves.toMatchObject({ userId: null })

        const { user, session } = await createUser('chat-slettes')
        await expect(chatUserOperations.optIn({ params: { userId: user.id }, session }))
            .resolves.toMatchObject({ localpart: 'chat-slettes2' })
    })
})

describe('reading a chat user', () => {
    test('finds none for a user who has not signed in to the chat', async () => {
        const { user, session } = await createUser('chat-uten')
        await expect(chatUserOperations.read({ params: { userId: user.id }, session }))
            .rejects.toMatchObject({ errorCode: 'NOT FOUND' })
    })

    test('is for the user themselves', async () => {
        const kari = await createUser('chat-les')
        const other = await createUser('chat-les-annen')
        const account = await chatUserOperations.optIn({ params: { userId: kari.user.id }, session: kari.session })
        await expect(chatUserOperations.read({ params: { userId: kari.user.id }, session: kari.session }))
            .resolves.toEqual(account)
        await expect(chatUserOperations.read({ params: { userId: kari.user.id }, session: other.session }))
            .rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
    })
})

describe('the spaces of a chat user', () => {
    test('are the ones they are in that are not destroyed, and theirs alone to see', async () => {
        const kari = await createUser('chat-omraader')
        const ola = await createUser('chat-omraader-annen')
        const ofKari = { params: { userId: kari.user.id } }
        const { id: chatUserId } = await chatUserOperations.optIn({ ...ofKari, session: kari.session })
        const space = await createChatSpace({ name: 'Vevcom', memberChatUserIds: [chatUserId] })
        await createChatSpace({ name: 'Borte', memberChatUserIds: [chatUserId], destroyed: true })
        await createChatSpace({ name: 'Andres' })

        await expect(chatUserOperations.readSpaces({ params: { userId: kari.user.id }, session: kari.session }))
            .resolves.toEqual({
                hasChatAccount: true,
                spaces: [{
                    id: space.id,
                    name: 'Vevcom',
                    committee: null,
                    mentionsNotificationChannel: expect.objectContaining({ id: space.mentionsNotificationChannelId }),
                    allNotificationChannel: expect.objectContaining({
                        id: space.allNotificationChannelId,
                        availableMethods: { email: false, emailWeekly: true, push: true },
                    }),
                }],
            })
        await expect(chatUserOperations.readSpaces({ params: { userId: kari.user.id }, session: ola.session }))
            .rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
    })

    test('are none for a user who has not signed in to the chat', async () => {
        const kari = await createUser('chat-uten-konto')

        await expect(chatUserOperations.readSpaces({ params: { userId: kari.user.id }, session: kari.session }))
            .resolves.toEqual({ hasChatAccount: false, spaces: [] })
    })
})
