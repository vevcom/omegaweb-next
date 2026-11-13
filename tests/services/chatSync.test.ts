import { FakeHomeserver } from 'tests/fakeHomeserver'
import { syncChat } from '@/lib/chatSync/sync'
import { roomLevelsOf, spaceLevelsOf } from '@/lib/chatSync/spaceChanges'
import { ROOM_ADMIN_LEVEL, SPACE_ADMIN_LEVEL } from '@/lib/chatSync/constants'
import { chatSpaceAdmins } from '@/services/chat/spaces/admins'
import { prisma } from '@/prisma-pn-client-instance'
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'

let homeserver: FakeHomeserver
/** The users the test has made admins of every MANUAL space, as the owning service would name them. */
let adminUserIds: number[]

beforeEach(() => {
    homeserver = new FakeHomeserver()
    adminUserIds = []
    chatSpaceAdmins.MANUAL = () => Promise.resolve(adminUserIds)
})

afterEach(async () => {
    Reflect.deleteProperty(chatSpaceAdmins, 'MANUAL')
    await prisma.chatSpace.deleteMany()
    await prisma.chatUser.deleteMany()
    await prisma.user.deleteMany({ where: { email: { endsWith: '@chat-sync.test' } } })
})

/** A user with a chat account here, who has signed in to the chat unless told otherwise. */
async function createChatUser(localpart: string, { signedIn = true } = {}) {
    const user = await prisma.user.create({
        data: {
            username: localpart,
            email: `${localpart}@chat-sync.test`,
            firstname: 'Kari',
            lastname: localpart,
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
    })
    const chatUser = await prisma.chatUser.create({ data: { userId: user.id, localpart } })
    if (signedIn) homeserver.signIn(localpart)
    return { user, chatUser, matrixId: homeserver.userIdOf(localpart) }
}

async function createSpace(name: string, members: { chatUser: { id: number } }[] = []) {
    return prisma.chatSpace.create({
        data: { purpose: 'MANUAL', name, members: { create: members.map(member => ({ chatUserId: member.chatUser.id })) } },
    })
}

const roomIdOf = async (space: { id: number }) =>
    (await prisma.chatSpace.findUniqueOrThrow({ where: { id: space.id } })).matrixRoomId!

describe('the names of the accounts', () => {
    test('are the users\' names, once the account is there', async () => {
        const kari = await createChatUser('kari', { signedIn: false })
        await syncChat(homeserver)
        expect(homeserver.names.size).toBe(0)
        expect(await prisma.chatUser.findUniqueOrThrow({ where: { id: kari.chatUser.id } }))
            .toMatchObject({ syncedName: null })

        homeserver.signIn('kari')
        await syncChat(homeserver)
        expect(homeserver.names.get(kari.matrixId)).toBe('Kari kari')
    })

    test('follow a changed name, and are not sent again while they stand', async () => {
        const kari = await createChatUser('kari')
        await syncChat(homeserver)
        await syncChat(homeserver)
        expect(homeserver.writes).toEqual([`name ${kari.matrixId}`])

        await prisma.user.update({ where: { id: kari.user.id }, data: { firstname: 'Karianne' } })
        await syncChat(homeserver)
        expect(homeserver.names.get(kari.matrixId)).toBe('Karianne kari')
    })
})

describe('the account of a deleted user', () => {
    test('is deactivated, once, and its localpart stays taken', async () => {
        const kari = await createChatUser('kari')
        const space = await createSpace('Space', [kari])
        await syncChat(homeserver)

        await prisma.user.delete({ where: { id: kari.user.id } })
        await syncChat(homeserver)
        await syncChat(homeserver)

        expect(homeserver.deactivated).toEqual([kari.matrixId])
        expect(await prisma.chatUser.findUniqueOrThrow({ where: { localpart: 'kari' } }))
            .toMatchObject({ userId: null, deactivatedAt: expect.any(Date) })
        expect(await prisma.chatSpaceMember.count({ where: { spaceId: space.id } })).toBe(0)
    })
})

describe('a space', () => {
    test('is made on the homeserver with its name, and renamed when the row is', async () => {
        const space = await createSpace('Vevcom')
        await syncChat(homeserver)
        const roomId = await roomIdOf(space)
        expect(homeserver.room(roomId).name).toBe('Vevcom')

        await prisma.chatSpace.update({ where: { id: space.id }, data: { name: 'Vevcom og venner' } })
        await syncChat(homeserver)
        expect(homeserver.room(roomId).name).toBe('Vevcom og venner')
        expect(homeserver.rooms.size).toBe(1)
    })

    test('has the members of its row who have an account', async () => {
        const kari = await createChatUser('kari')
        const ola = await createChatUser('ola', { signedIn: false })
        const space = await createSpace('Space', [kari, ola])
        await syncChat(homeserver)
        expect(homeserver.room(await roomIdOf(space)).members).toEqual([homeserver.botUserId, kari.matrixId])

        homeserver.signIn('ola')
        await syncChat(homeserver)
        expect(homeserver.room(await roomIdOf(space)).members).toContain(ola.matrixId)
    })

    test('loses a member whose row is removed, in its rooms too', async () => {
        const kari = await createChatUser('kari')
        const ola = await createChatUser('ola')
        const space = await createSpace('Space', [kari, ola])
        await syncChat(homeserver)
        const roomId = await roomIdOf(space)
        const room = homeserver.makeRoom(roomId, kari.matrixId)
        homeserver.room(room).members.push(ola.matrixId)

        await prisma.chatSpaceMember.deleteMany({ where: { chatUserId: ola.chatUser.id } })
        await syncChat(homeserver)

        expect(homeserver.room(roomId).members).not.toContain(ola.matrixId)
        expect(homeserver.room(room).members).not.toContain(ola.matrixId)
        expect(homeserver.room(room).members).toContain(kari.matrixId)
    })

    test('loses an archived user, and someone who got in past the application', async () => {
        const kari = await createChatUser('kari')
        const space = await createSpace('Space', [kari])
        await syncChat(homeserver)
        const roomId = await roomIdOf(space)
        const stranger = homeserver.signIn('stranger')
        homeserver.room(roomId).members.push(stranger)

        await prisma.user.update({ where: { id: kari.user.id }, data: { archived: true } })
        await syncChat(homeserver)

        expect(homeserver.room(roomId).members).toEqual([homeserver.botUserId])
    })

    test('is left as it is by a run with nothing to change', async () => {
        const kari = await createChatUser('kari')
        adminUserIds = [kari.user.id]
        const space = await createSpace('Space', [kari])
        await syncChat(homeserver)
        homeserver.makeRoom(await roomIdOf(space), kari.matrixId)
        await syncChat(homeserver)
        await syncChat(homeserver)

        const settled = homeserver.writes.length
        await syncChat(homeserver)
        expect(homeserver.writes).toHaveLength(settled)
    })
})

describe('the admins of a space', () => {
    test('are whoever the owning service names, are members, and add and remove rooms', async () => {
        const kari = await createChatUser('kari')
        const ola = await createChatUser('ola')
        adminUserIds = [kari.user.id]
        const space = await createSpace('Space', [ola])
        await syncChat(homeserver)

        const { members, levels } = homeserver.room(await roomIdOf(space))
        expect(members).toEqual(expect.arrayContaining([kari.matrixId, ola.matrixId]))
        expect(levels.users).toEqual({ [kari.matrixId]: SPACE_ADMIN_LEVEL })
    })

    test('lose the level when they are admins no longer, and stay in the space', async () => {
        const kari = await createChatUser('kari')
        const ola = await createChatUser('ola')
        adminUserIds = [kari.user.id]
        const space = await createSpace('Space')
        await syncChat(homeserver)

        adminUserIds = [ola.user.id]
        await syncChat(homeserver)

        const { members, levels } = homeserver.room(await roomIdOf(space))
        expect(levels.users).toEqual({ [ola.matrixId]: SPACE_ADMIN_LEVEL })
        expect(members).toContain(kari.matrixId)
    })

    test('are not those the service names who have no chat account', async () => {
        const kari = await createChatUser('kari')
        const without = await prisma.user.create({
            data: {
                username: 'without',
                email: 'without@chat-sync.test',
                bioParagraph: { create: {} },
                ledgerAccount: { create: { type: 'USER' } },
            },
        })
        adminUserIds = [kari.user.id, without.id]
        const space = await createSpace('Space')
        await syncChat(homeserver)
        expect(homeserver.room(await roomIdOf(space)).levels.users).toEqual({ [kari.matrixId]: SPACE_ADMIN_LEVEL })
    })

    test('are admins of the rooms of the space, from the run after the bot has entered them', async () => {
        const kari = await createChatUser('kari')
        const ola = await createChatUser('ola')
        adminUserIds = [kari.user.id]
        const space = await createSpace('Space', [ola])
        await syncChat(homeserver)
        const room = homeserver.makeRoom(await roomIdOf(space), ola.matrixId)

        await syncChat(homeserver)
        expect(homeserver.room(room).members).toContain(homeserver.botUserId)
        expect(homeserver.room(room).levels.users).toEqual({ [homeserver.botUserId]: 100 })

        await syncChat(homeserver)
        expect(homeserver.room(room).levels.users)
            .toEqual({ [homeserver.botUserId]: 100, [kari.matrixId]: ROOM_ADMIN_LEVEL })

        adminUserIds = []
        await syncChat(homeserver)
        expect(homeserver.room(room).levels.users).toEqual({ [homeserver.botUserId]: 100 })
    })

    test('are given no level in a room they made, where they outrank every level', async () => {
        const kari = await createChatUser('kari')
        adminUserIds = [kari.user.id]
        const space = await createSpace('Space')
        await syncChat(homeserver)
        const room = homeserver.makeRoom(await roomIdOf(space), kari.matrixId)

        await syncChat(homeserver)
        await syncChat(homeserver)
        expect(homeserver.room(room).levels.users).toEqual({ [homeserver.botUserId]: 100 })
    })
})

describe('the levels of a room', () => {
    test('are the room\'s own, but for the one level the sync gives and takes', () => {
        const current = { '@bot:x': 100, '@moderator:x': 50, '@former:x': ROOM_ADMIN_LEVEL, '@owner:x': 100 }
        expect(roomLevelsOf(current, ['@admin:x', '@owner:x', '@moderator:x'])).toEqual({
            '@bot:x': 100,
            '@owner:x': 100,
            '@moderator:x': ROOM_ADMIN_LEVEL,
            '@admin:x': ROOM_ADMIN_LEVEL,
        })
    })

    test('in a space are the admins\' alone', () => {
        expect(spaceLevelsOf(['@a:x', '@b:x'])).toEqual({ '@a:x': SPACE_ADMIN_LEVEL, '@b:x': SPACE_ADMIN_LEVEL })
    })
})

describe('a destroyed space', () => {
    test('is emptied, its rooms too, left by the bot and forgotten', async () => {
        const kari = await createChatUser('kari')
        adminUserIds = [kari.user.id]
        const space = await createSpace('Space', [kari])
        await syncChat(homeserver)
        const roomId = await roomIdOf(space)
        const room = homeserver.makeRoom(roomId, kari.matrixId)
        await syncChat(homeserver)

        await prisma.chatSpace.update({ where: { id: space.id }, data: { destroyedAt: new Date() } })
        await syncChat(homeserver)

        expect(homeserver.room(roomId).members).toEqual([])
        expect(homeserver.room(room).members).toEqual([])
        expect(await prisma.chatSpace.count()).toBe(0)
    })

    test('that was never made on the homeserver is only forgotten', async () => {
        await prisma.chatSpace.create({ data: { purpose: 'MANUAL', name: 'Space', destroyedAt: new Date() } })
        await syncChat(homeserver)
        expect(homeserver.rooms.size).toBe(0)
        expect(await prisma.chatSpace.count()).toBe(0)
    })

    test('keeps its row while the homeserver will not let someone out of it', async () => {
        const kari = await createChatUser('kari')
        const space = await createSpace('Space', [kari])
        await syncChat(homeserver)
        homeserver.broken.push(await roomIdOf(space))

        await prisma.chatSpace.update({ where: { id: space.id }, data: { destroyedAt: new Date() } })
        await expect(syncChat(homeserver)).rejects.toThrow(`remove ${kari.matrixId}`)
        expect(await prisma.chatSpace.count()).toBe(1)
    })
})

describe('a change the homeserver refuses', () => {
    test('does not keep the rest of the run from being done, and is named when the run is through', async () => {
        const kari = await createChatUser('kari')
        const first = await createSpace('First', [kari])
        const second = await createSpace('Second', [kari])
        await syncChat(homeserver)
        homeserver.broken.push(await roomIdOf(first))

        await prisma.chatSpace.updateMany({ data: { name: 'Renamed' } })
        await expect(syncChat(homeserver)).rejects.toThrow('rename the space to Renamed')

        expect(homeserver.room(await roomIdOf(first)).name).toBe('First')
        expect(homeserver.room(await roomIdOf(second)).name).toBe('Renamed')
    })
})
