import { createChatSpace } from 'tests/chatSpaces'
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
        setRooms: () => Require.user(),
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
        const anothers = await createChatSpace({ name: 'Andres' })
        const committees = await createChatSpace({ purpose: 'COMMITTEE', name: 'Mine' })

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

    test('have rooms, which are made, renamed, and destroyed by being marked for the chat sync to empty', async () => {
        const { session } = await createUser('spaces-rooms')
        const space = await createMine()
        const anotherSpace = await createMine()
        const params = { spaceId: space.id }

        const room = await mySpaces.createRoom({ params, session, data: { name: 'Prat', isPrivate: false } })
        await mySpaces.updateRoom({ params: { ...params, roomId: room.id }, session, data: { name: 'Skravling' } })
        await expect(mySpaces.readRooms({ params, session })).resolves.toEqual([
            { id: room.id, name: 'Skravling', onHomeserver: false, isPrivate: false, pickedMembers: [] },
        ])

        const roomOfAnotherSpace = { spaceId: anotherSpace.id, roomId: room.id }
        await expect(mySpaces.destroyRoom({ params: roomOfAnotherSpace, session }))
            .rejects.toMatchObject({ errorCode: 'NOT FOUND' })

        await mySpaces.destroyRoom({ params: { ...params, roomId: room.id }, session })
        await expect(mySpaces.readRooms({ params, session })).resolves.toEqual([])
        expect(await prisma.chatSpaceRoom.findUniqueOrThrow({ where: { id: room.id } }))
            .toMatchObject({ destroyedAt: expect.any(Date) })
    })

    test('take no room once they are destroyed', async () => {
        const { session } = await createUser('spaces-rooms-late')
        const space = await createMine()
        const params = { spaceId: space.id }
        await mySpaces.destroy({ params, session })

        await expect(mySpaces.createRoom({ params, session, data: { name: 'Prat', isPrivate: false } }))
            .rejects.toMatchObject({ errorCode: 'NOT FOUND' })
    })

    test('have private rooms, which take members of the space and lose them with the space', async () => {
        const { session } = await createUser('spaces-private')
        const kari = await createUser('spaces-private-kari')
        const outsider = await createUser('spaces-private-outsider')
        const space = await createMine()
        const params = { spaceId: space.id }
        await mySpaces.addMembers({ params, session, data: { userIds: [kari.user.id] } })
        const styret = await mySpaces.createRoom({ params, session, data: { name: 'Styret', isPrivate: true } })
        const ofStyret = { ...params, roomId: styret.id }

        await mySpaces.addRoomMembers({ params: ofStyret, session, data: { userIds: [kari.user.id] } })
        await expect(mySpaces.addRoomMembers({ params: ofStyret, session, data: { userIds: [outsider.user.id] } }))
            .rejects.toMatchObject({ errorCode: 'BAD DATA' })
        await expect(mySpaces.readRooms({ params, session })).resolves.toMatchObject([
            { id: styret.id, isPrivate: true, pickedMembers: [{ id: kari.user.id, username: 'spaces-private-kari' }] },
        ])

        await mySpaces.removeMembers({ params, session, data: { userIds: [kari.user.id] } })
        await expect(mySpaces.readRooms({ params, session })).resolves.toMatchObject([{ pickedMembers: [] }])
    })

    test('have rooms every member may enter, which nobody is picked for', async () => {
        const { session } = await createUser('spaces-open')
        const kari = await createUser('spaces-open-kari')
        const space = await createMine()
        const params = { spaceId: space.id }
        await mySpaces.addMembers({ params, session, data: { userIds: [kari.user.id] } })
        const prat = await mySpaces.createRoom({ params, session, data: { name: 'Prat', isPrivate: false } })
        const ofPrat = { ...params, roomId: prat.id }

        await expect(mySpaces.addRoomMembers({ params: ofPrat, session, data: { userIds: [kari.user.id] } }))
            .rejects.toMatchObject({ errorCode: 'BAD DATA' })
    })

    test('have a channel for mentions and one for every other message, named for them under the chat channel', async () => {
        const { session } = await createUser('spaces-channels')
        const space = await createMine()
        const channelsOf = async () => {
            const { mentionsNotificationChannel: mentions, allNotificationChannel: all } =
                await prisma.chatSpace.findUniqueOrThrow({
                    where: { id: space.id },
                    select: {
                        mentionsNotificationChannel: { include: { availableMethods: true, parent: true } },
                        allNotificationChannel: { include: { availableMethods: true, parent: true } },
                    },
                })
            return { mentions, all }
        }

        const made = await channelsOf()
        expect(made.mentions).toMatchObject({
            name: `Mine (chat #${space.id}): omtaler`,
            purpose: 'CHAT_SPACE_MENTIONS',
            parent: { special: 'CHAT' },
            availableMethods: { email: true, emailWeekly: false, push: true },
        })
        expect(made.all).toMatchObject({
            name: `Mine (chat #${space.id}): alle meldinger`,
            purpose: 'CHAT_SPACE_ALL',
            parent: { special: 'CHAT' },
            availableMethods: { email: false, emailWeekly: false, push: true },
        })

        await mySpaces.update({ params: { spaceId: space.id }, session, data: { name: 'Mine, omdøpt' } })
        expect((await channelsOf()).mentions.name).toBe(`Mine, omdøpt (chat #${space.id}): omtaler`)
        expect((await channelsOf()).all.id).toBe(made.all.id)
    })

    test('tell those who set their members who can be added: anyone with a chat account, a former student too', async () => {
        const { session } = await createUser('spaces-addable-admin', { chatAccount: false })
        const formerStudent = await createUser('spaces-addable-former')
        await createUser('spaces-addable-without', { chatAccount: false })
        const archived = await createUser('spaces-addable-archived')
        await prisma.user.update({ where: { id: archived.user.id }, data: { archived: true } })
        const space = await createMine()
        const firstPage = {
            paging: {
                page: { page: 0 as const, pageSize: 50, cursor: null },
                details: { partOfName: 'spaces-addable', groups: [] },
            },
        }

        const addable = await mySpaces.readAddableUsers({ params: { spaceId: space.id, ...firstPage }, session })
        expect(addable.map(user => user.username)).toEqual(['spaces-addable-former'])
        await mySpaces.addMembers({ params: { spaceId: space.id }, session, data: { userIds: [formerStudent.user.id] } })

        // None of them is an active student, so the user list itself shows none of them.
        await expect(userOperations.readPage({ params: firstPage, bypassAuth: true })).resolves.toEqual([])
        await expect(mySpaces.readAddableUsers({ params: { spaceId: space.id, ...firstPage }, session: Session.empty() }))
            .rejects.toMatchObject({ errorCode: 'UNAUTHENTICATED' })
    })
})
