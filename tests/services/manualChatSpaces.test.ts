import { FakeHomeserver } from 'tests/fakeHomeserver'
import { testSession } from 'tests/utils'
import { syncChat } from '@/lib/chatSync/sync'
import { ROOM_MODERATOR_LEVEL } from '@/lib/chatSync/constants'
import { manualChatSpaceOperations } from '@/services/manualChat/operations'
import { userOperations } from '@/services/users/operations'
import { prisma } from '@/prisma-pn-client-instance'
import { afterEach, describe, expect, test } from '@jest/globals'

async function createUser(username: string, { mayAdministerSpaces = false } = {}) {
    const { id } = await prisma.user.create({
        data: {
            username,
            email: `${username}@manual-chat.test`,
            firstname: 'Kari',
            lastname: username,
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
            chatUser: { create: { localpart: username } },
        },
    })
    const user = await userOperations.read({ params: { id }, bypassAuth: true })
    const permissions = mayAdministerSpaces ? ['MANUAL_CHAT_SPACE_ADMIN' as const] : []
    return { user, session: testSession({ user, permissions }) }
}

const ofSpace = (space: { id: number }) => ({ params: { spaceId: space.id } })

afterEach(async () => {
    await prisma.chatSpace.deleteMany()
    await prisma.chatUser.deleteMany()
    await prisma.user.deleteMany({ where: { email: { endsWith: '@manual-chat.test' } } })
})

describe('a manual chat space', () => {
    test('is made, renamed and destroyed by those with the permission, and no one else', async () => {
        const boss = await createUser('sjef', { mayAdministerSpaces: true })
        const kari = await createUser('kari')

        await expect(manualChatSpaceOperations.create({ data: { name: 'Spillkveld' }, session: kari.session }))
            .rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
        const space = await manualChatSpaceOperations.create({ data: { name: 'Spillkveld' }, session: boss.session })
        expect(space).toMatchObject({ purpose: 'MANUAL', name: 'Spillkveld' })

        await manualChatSpaceOperations.update({ ...ofSpace(space), data: { name: 'Brettspill' }, session: boss.session })
        await expect(manualChatSpaceOperations.readAll({ session: boss.session })).resolves.toEqual([
            { id: space.id, name: 'Brettspill', admins: [], memberCount: 0 },
        ])

        await manualChatSpaceOperations.destroy({ ...ofSpace(space), session: boss.session })
        await expect(manualChatSpaceOperations.readAll({ session: boss.session })).resolves.toEqual([])
    })

    test('has the admins picked for it, who set its members and rooms and nothing else', async () => {
        const boss = await createUser('sjef', { mayAdministerSpaces: true })
        const kari = await createUser('kari')
        const ola = await createUser('ola')
        const space = await manualChatSpaceOperations.create({ data: { name: 'Spillkveld' }, session: boss.session })

        await expect(manualChatSpaceOperations.read({ ...ofSpace(space), session: kari.session }))
            .rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
        await manualChatSpaceOperations.addAdmins({
            ...ofSpace(space),
            data: { userIds: [kari.user.id] },
            session: boss.session,
        })

        await manualChatSpaceOperations.addMembers({
            ...ofSpace(space),
            data: { userIds: [ola.user.id] },
            session: kari.session,
        })
        await manualChatSpaceOperations.createRoom({
            ...ofSpace(space),
            data: { name: 'Prat', isPrivate: false },
            session: kari.session,
        })
        await expect(manualChatSpaceOperations.read({ ...ofSpace(space), session: kari.session })).resolves.toMatchObject({
            space: { id: space.id, name: 'Spillkveld' },
            rooms: [{ name: 'Prat' }],
            members: [{ id: ola.user.id }],
            admins: [{ id: kari.user.id }],
        })
        await expect(manualChatSpaceOperations.readAdministered({ params: { userId: kari.user.id }, session: kari.session }))
            .resolves.toEqual([{ id: space.id, name: 'Spillkveld' }])

        const asKari = { ...ofSpace(space), session: kari.session }
        await expect(manualChatSpaceOperations.addAdmins({ ...asKari, data: { userIds: [ola.user.id] } }))
            .rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
        await expect(manualChatSpaceOperations.update({ ...asKari, data: { name: 'Mitt' } }))
            .rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
        await expect(manualChatSpaceOperations.destroy(asKari)).rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
    })

    test('has its admins in it, moderating its rooms, and one who is an admin no longer stays in it', async () => {
        const homeserver = new FakeHomeserver()
        const boss = await createUser('sjef', { mayAdministerSpaces: true })
        const kari = await createUser('kari')
        homeserver.signIn('kari')
        const space = await manualChatSpaceOperations.create({ data: { name: 'Spillkveld' }, session: boss.session })
        const room = await manualChatSpaceOperations.createRoom({
            ...ofSpace(space),
            data: { name: 'Prat', isPrivate: false },
            session: boss.session,
        })
        const asBoss = { ...ofSpace(space), data: { userIds: [kari.user.id] }, session: boss.session }

        await manualChatSpaceOperations.addAdmins(asBoss)
        await syncChat(homeserver)
        await syncChat(homeserver)
        const { matrixRoomId: spaceRoomId } = await prisma.chatSpace.findUniqueOrThrow({ where: { id: space.id } })
        const { matrixRoomId: roomId } = await prisma.chatSpaceRoom.findUniqueOrThrow({ where: { id: room.id } })
        expect(homeserver.room(spaceRoomId!).members).toContain(homeserver.userIdOf('kari'))
        expect(homeserver.room(roomId!).levels.users).toEqual({ [homeserver.userIdOf('kari')]: ROOM_MODERATOR_LEVEL })

        await manualChatSpaceOperations.removeAdmins(asBoss)
        await syncChat(homeserver)
        expect(homeserver.room(roomId!).levels.users).toEqual({})
        expect(homeserver.room(spaceRoomId!).members).toContain(homeserver.userIdOf('kari'))
    })

    test('is not a committee\'s space, which this service leaves alone', async () => {
        const boss = await createUser('sjef', { mayAdministerSpaces: true })
        const committees = await prisma.chatSpace.create({ data: { purpose: 'COMMITTEE', name: 'Komité' } })

        await expect(manualChatSpaceOperations.read({ ...ofSpace(committees), session: boss.session }))
            .rejects.toMatchObject({ errorCode: 'NOT FOUND' })
        await expect(manualChatSpaceOperations.destroy({ ...ofSpace(committees), session: boss.session }))
            .rejects.toMatchObject({ errorCode: 'DISSALLOWED' })
        await expect(manualChatSpaceOperations.addAdmins({
            ...ofSpace(committees),
            data: { userIds: [boss.user.id] },
            session: boss.session,
        })).rejects.toMatchObject({ errorCode: 'NOT FOUND' })
    })
})
