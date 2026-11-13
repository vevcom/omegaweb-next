import { implementChatSpaces } from '@/services/chat/spaces/implement'
import { Require } from '@/auth/authorizer/Require'
import { userOperations } from '@/services/users/operations'
import { prisma } from '@/prisma-pn-client-instance'
import { Session } from '@/auth/session/Session'
import { afterEach, describe, expect, test } from '@jest/globals'

/** A service that owns the MANUAL spaces named "Mine", and lets any user at them. */
const mySpaces = implementChatSpaces({
    purpose: 'MANUAL',
    authorizers: {
        read: () => Require.user(),
        update: () => Require.user(),
        destroy: () => Require.user(),
        setMembers: () => Require.user(),
    },
    ownershipCheck: async ({ prisma: client, spaceId }) =>
        (await client.chatSpace.findUniqueOrThrow({ where: { id: spaceId } })).name.startsWith('Mine'),
})

async function createUser(username: string, { chatAccount = true } = {}) {
    const created = await prisma.user.create({
        data: {
            username,
            email: `${username}@chat-spaces.test`,
            firstname: 'Kari',
            lastname: 'Nordmann',
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
            ...(chatAccount ? { chatUser: { create: { localpart: username } } } : {}),
        },
    })
    const user = await userOperations.read({ params: { id: created.id }, bypassAuth: true })
    return { user, session: Session.fromJsObject({ user, permissions: [], memberships: [] }) }
}

const createMine = () => mySpaces.internal.create.internalCall({ data: { name: 'Mine' } })

afterEach(async () => {
    await prisma.chatSpace.deleteMany()
    await prisma.user.deleteMany({ where: { email: { endsWith: '@chat-spaces.test' } } })
})

describe('the chat spaces of a service', () => {
    test('are made with the service\'s purpose, and read by those its authorizer lets through', async () => {
        const { session } = await createUser('spaces-reader')
        const space = await createMine()
        expect(space).toMatchObject({ purpose: 'MANUAL', name: 'Mine', matrixRoomId: null })

        await expect(mySpaces.read({ params: { spaceId: space.id }, session })).resolves.toMatchObject({ id: space.id })
        await expect(mySpaces.read({ params: { spaceId: space.id }, session: Session.empty() }))
            .rejects.toMatchObject({ errorCode: 'UNAUTHENTICATED' })
    })

    test('are only the spaces the service owns', async () => {
        const { session } = await createUser('spaces-owner')
        const anothers = await prisma.chatSpace.create({ data: { purpose: 'MANUAL', name: 'Andres' } })
        const committees = await prisma.chatSpace.create({ data: { purpose: 'COMMITTEE', name: 'Mine' } })

        for (const space of [anothers, committees]) {
            await expect(mySpaces.read({ params: { spaceId: space.id }, session }))
                .rejects.toMatchObject({ errorCode: 'DISSALLOWED' })
            await expect(mySpaces.destroy({ params: { spaceId: space.id }, session }))
                .rejects.toMatchObject({ errorCode: 'DISSALLOWED' })
        }
    })

    test('take as members those who have signed in to the chat, and no one else', async () => {
        const { session } = await createUser('spaces-admin')
        const kari = await createUser('spaces-kari')
        const without = await createUser('spaces-without', { chatAccount: false })
        const space = await createMine()
        const params = { spaceId: space.id }

        await mySpaces.addMembers({ params, session, data: { userIds: [kari.user.id] } })
        await mySpaces.addMembers({ params, session, data: { userIds: [kari.user.id] } })
        await expect(mySpaces.addMembers({ params, session, data: { userIds: [kari.user.id, without.user.id] } }))
            .rejects.toMatchObject({ errorCode: 'BAD DATA' })

        await expect(mySpaces.readMembers({ params, session })).resolves.toEqual([
            expect.objectContaining({ id: kari.user.id, username: 'spaces-kari', onHomeserver: false }),
        ])

        await mySpaces.removeMembers({ params, session, data: { userIds: [kari.user.id] } })
        await expect(mySpaces.readMembers({ params, session })).resolves.toEqual([])
    })

    test('are renamed, and destroyed by being marked for the chat sync to empty', async () => {
        const { session } = await createUser('spaces-destroyer')
        const space = await createMine()
        const params = { spaceId: space.id }

        await mySpaces.update({ params, session, data: { name: 'Mine, nå med nytt navn' } })
        expect(await prisma.chatSpace.findUniqueOrThrow({ where: { id: space.id } }))
            .toMatchObject({ name: 'Mine, nå med nytt navn' })

        await mySpaces.destroy({ params, session })
        expect(await prisma.chatSpace.findUniqueOrThrow({ where: { id: space.id } }))
            .toMatchObject({ destroyedAt: expect.any(Date) })
        await expect(mySpaces.read({ params, session })).rejects.toMatchObject({ errorCode: 'NOT FOUND' })
    })
})
