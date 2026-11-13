import { createChatSpace } from 'tests/chatSpaces'
import { FakeHomeserver } from 'tests/fakeHomeserver'
import { syncChat } from '@/lib/chatSync/sync'
import { ROOM_MODERATOR_LEVEL } from '@/lib/chatSync/constants'
import { chatSpaceAdmins, chatSpaceStandingMembers } from '@/services/chat/spaces/admins'
import { prisma } from '@/prisma-pn-client-instance'
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'

let homeserver: FakeHomeserver
let adminUserIds: number[]
let standingMemberUserIds: number[]

beforeEach(() => {
    homeserver = new FakeHomeserver()
    adminUserIds = []
    standingMemberUserIds = []
    chatSpaceAdmins.MANUAL = () => Promise.resolve(adminUserIds)
    chatSpaceStandingMembers.MANUAL = () => Promise.resolve(standingMemberUserIds)
})

afterEach(async () => {
    Reflect.deleteProperty(chatSpaceAdmins, 'MANUAL')
    Reflect.deleteProperty(chatSpaceStandingMembers, 'MANUAL')
    await prisma.chatSpace.deleteMany()
    await prisma.chatUser.deleteMany()
    await prisma.user.deleteMany({ where: { email: { endsWith: '@chat-sync.test' } } })
})

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

const createSpace = (name: string, members: { chatUser: { id: number } }[] = []) =>
    createChatSpace({ name, memberChatUserIds: members.map(member => member.chatUser.id) })

const spaceRoomIdOf = async (space: { id: number }) =>
    (await prisma.chatSpace.findUniqueOrThrow({ where: { id: space.id } })).matrixRoomId!

const createRoom = (space: { id: number }, name = 'Prat') =>
    prisma.chatSpaceRoom.create({ data: { spaceId: space.id, name } })

const roomIdOf = async (room: { id: number }) =>
    (await prisma.chatSpaceRoom.findUniqueOrThrow({ where: { id: room.id } })).matrixRoomId!

const markDestroyed = { data: { destroyedAt: new Date() } }

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

describe('an account the homeserver will not answer for', () => {
    test('keeps neither the other names nor the spaces from being synced, and is named', async () => {
        const kari = await createChatUser('kari')
        const ola = await createChatUser('ola')
        const space = await createSpace('Space', [ola])
        homeserver.accountsFailingLookup.push(kari.matrixId)

        await expect(syncChat(homeserver)).rejects.toThrow(`look up ${kari.matrixId}`)

        expect(homeserver.names.get(ola.matrixId)).toBe('Kari ola')
        expect(await spaceRoomIdOf(space)).not.toBeNull()
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
        const spaceRoomId = await spaceRoomIdOf(space)
        expect(homeserver.room(spaceRoomId).name).toBe('Vevcom')

        await prisma.chatSpace.update({ where: { id: space.id }, data: { name: 'Vevcom og venner' } })
        await syncChat(homeserver)
        expect(homeserver.room(spaceRoomId).name).toBe('Vevcom og venner')
        expect(homeserver.rooms.size).toBe(1)
    })

    test('has the members of its row who have an account', async () => {
        const kari = await createChatUser('kari')
        const ola = await createChatUser('ola', { signedIn: false })
        const space = await createSpace('Space', [kari, ola])
        await syncChat(homeserver)
        expect(homeserver.room(await spaceRoomIdOf(space)).members).toEqual([homeserver.botUserId, kari.matrixId])

        homeserver.signIn('ola')
        await syncChat(homeserver)
        expect(homeserver.room(await spaceRoomIdOf(space)).members).toContain(ola.matrixId)
    })

    test('loses a member whose row is removed, in its rooms too', async () => {
        const kari = await createChatUser('kari')
        const ola = await createChatUser('ola')
        const space = await createSpace('Space', [kari, ola])
        const room = await createRoom(space)
        await syncChat(homeserver)
        const spaceRoomId = await spaceRoomIdOf(space)
        const roomId = await roomIdOf(room)
        homeserver.join(roomId, kari.matrixId)
        homeserver.join(roomId, ola.matrixId)

        await prisma.chatSpaceMember.deleteMany({ where: { chatUserId: ola.chatUser.id } })
        await syncChat(homeserver)

        expect(homeserver.room(spaceRoomId).members).toEqual([homeserver.botUserId, kari.matrixId])
        expect(homeserver.room(roomId).members).toEqual([homeserver.botUserId, kari.matrixId])
    })

    test('loses an archived user, and someone who got in past the application', async () => {
        const kari = await createChatUser('kari')
        const space = await createSpace('Space', [kari])
        await syncChat(homeserver)
        const spaceRoomId = await spaceRoomIdOf(space)
        homeserver.room(spaceRoomId).members.push(homeserver.signIn('stranger'))

        await prisma.user.update({ where: { id: kari.user.id }, data: { archived: true } })
        await syncChat(homeserver)

        expect(homeserver.room(spaceRoomId).members).toEqual([homeserver.botUserId])
    })

    test('takes back the invitation of one whose join failed and whose row is removed', async () => {
        const kari = await createChatUser('kari')
        const space = await createSpace('Space')
        await syncChat(homeserver)
        const spaceRoomId = await spaceRoomIdOf(space)
        await prisma.chatSpaceMember.create({ data: { spaceId: space.id, chatUserId: kari.chatUser.id } })
        homeserver.changesRefusedOnce.push(`add ${kari.matrixId} to ${spaceRoomId}`)
        await expect(syncChat(homeserver)).rejects.toThrow()
        expect(homeserver.room(spaceRoomId).invited).toEqual([kari.matrixId])

        await prisma.chatSpaceMember.deleteMany({ where: { chatUserId: kari.chatUser.id } })
        await syncChat(homeserver)

        expect(homeserver.room(spaceRoomId).invited).toEqual([])
    })

    test('is left as it is by a run with nothing to change', async () => {
        const kari = await createChatUser('kari')
        adminUserIds = [kari.user.id]
        const space = await createSpace('Space', [kari])
        await createRoom(space)
        await syncChat(homeserver)

        const settled = homeserver.writes.length
        await syncChat(homeserver)
        expect(homeserver.writes).toHaveLength(settled)
    })
})

describe('the standing members of a space', () => {
    test('are whoever the owning service names, and are in it without anyone adding them', async () => {
        const kari = await createChatUser('kari')
        standingMemberUserIds = [kari.user.id]
        const space = await createSpace('Space')
        await syncChat(homeserver)

        expect(homeserver.room(await spaceRoomIdOf(space)).members).toContain(kari.matrixId)
        expect(await prisma.chatSpaceMember.count({ where: { spaceId: space.id } })).toBe(1)
    })

    test('stay in the space when they are named no longer, until their row is removed', async () => {
        const kari = await createChatUser('kari')
        standingMemberUserIds = [kari.user.id]
        const space = await createSpace('Space')
        await syncChat(homeserver)

        standingMemberUserIds = []
        await syncChat(homeserver)
        expect(homeserver.room(await spaceRoomIdOf(space)).members).toContain(kari.matrixId)

        await prisma.chatSpaceMember.deleteMany({ where: { spaceId: space.id } })
        await syncChat(homeserver)
        expect(homeserver.room(await spaceRoomIdOf(space)).members).not.toContain(kari.matrixId)
    })

    test('are in the space from the run after they first sign in to the chat', async () => {
        const kari = await prisma.user.create({
            data: {
                username: 'kari',
                email: 'kari@chat-sync.test',
                bioParagraph: { create: {} },
                ledgerAccount: { create: { type: 'USER' } },
            },
        })
        standingMemberUserIds = [kari.id]
        const space = await createSpace('Space')
        await syncChat(homeserver)
        expect(await prisma.chatSpaceMember.count({ where: { spaceId: space.id } })).toBe(0)

        await prisma.chatUser.create({ data: { userId: kari.id, localpart: 'kari' } })
        homeserver.signIn('kari')
        await syncChat(homeserver)
        await syncChat(homeserver)
        expect(homeserver.room(await spaceRoomIdOf(space)).members).toContain(homeserver.userIdOf('kari'))
    })
})

describe('the admins of a space', () => {
    test('are whoever the owning service names, are members, and hold no level in the space', async () => {
        const kari = await createChatUser('kari')
        const ola = await createChatUser('ola')
        adminUserIds = [kari.user.id]
        const space = await createSpace('Space', [ola])
        await syncChat(homeserver)

        const { members, levels } = homeserver.room(await spaceRoomIdOf(space))
        expect(members).toEqual(expect.arrayContaining([kari.matrixId, ola.matrixId]))
        expect(levels.users).toEqual({})
    })

    test('moderate its rooms, until they are admins no longer, and stay in the space', async () => {
        const kari = await createChatUser('kari')
        const ola = await createChatUser('ola')
        adminUserIds = [kari.user.id]
        const space = await createSpace('Space')
        const room = await createRoom(space)
        await syncChat(homeserver)
        const roomId = await roomIdOf(room)
        expect(homeserver.room(roomId).levels.users).toEqual({ [kari.matrixId]: ROOM_MODERATOR_LEVEL })

        adminUserIds = [ola.user.id]
        await syncChat(homeserver)

        expect(homeserver.room(roomId).levels.users).toEqual({ [ola.matrixId]: ROOM_MODERATOR_LEVEL })
        expect(homeserver.room(await spaceRoomIdOf(space)).members).toContain(kari.matrixId)
    })

    test('are not those the service names who have no chat account', async () => {
        const kari = await createChatUser('kari')
        const withoutChatAccount = await prisma.user.create({
            data: {
                username: 'without',
                email: 'without@chat-sync.test',
                bioParagraph: { create: {} },
                ledgerAccount: { create: { type: 'USER' } },
            },
        })
        adminUserIds = [kari.user.id, withoutChatAccount.id]
        const space = await createSpace('Space')
        const room = await createRoom(space)
        await syncChat(homeserver)

        expect(homeserver.room(await roomIdOf(room)).levels.users).toEqual({ [kari.matrixId]: ROOM_MODERATOR_LEVEL })
    })
})

describe('a room of a space', () => {
    test('is made from its row, listed in the space, and renamed when the row is', async () => {
        const space = await createSpace('Space')
        const room = await createRoom(space, 'Prat')
        await syncChat(homeserver)
        const roomId = await roomIdOf(room)

        expect(homeserver.room(roomId).name).toBe('Prat')
        expect(homeserver.room(await spaceRoomIdOf(space)).listedRoomIds).toEqual([roomId])

        await prisma.chatSpaceRoom.update({ where: { id: room.id }, data: { name: 'Skravling' } })
        await syncChat(homeserver)
        expect(homeserver.room(roomId).name).toBe('Skravling')
        expect(homeserver.rooms.size).toBe(2)
    })

    test('is for the members of the space to enter, and the sync puts nobody in it', async () => {
        const kari = await createChatUser('kari')
        const space = await createSpace('Space', [kari])
        const room = await createRoom(space)
        await syncChat(homeserver)
        const roomId = await roomIdOf(room)
        expect(homeserver.room(roomId).members).toEqual([homeserver.botUserId])

        homeserver.join(roomId, kari.matrixId)
        await syncChat(homeserver)
        expect(homeserver.room(roomId).members).toEqual([homeserver.botUserId, kari.matrixId])
    })

    test('loses whoever is in it without being in the space', async () => {
        const space = await createSpace('Space')
        const room = await createRoom(space)
        await syncChat(homeserver)
        const roomId = await roomIdOf(room)
        homeserver.room(roomId).members.push(homeserver.signIn('stranger'))

        await syncChat(homeserver)

        expect(homeserver.room(roomId).members).toEqual([homeserver.botUserId])
    })

    test('the homeserver will not make is made on a later run', async () => {
        const space = await createSpace('Space')
        await syncChat(homeserver)
        const room = await createRoom(space, 'Prat')
        homeserver.roomsRefusingEveryChange.push(await spaceRoomIdOf(space))

        await expect(syncChat(homeserver)).rejects.toThrow('make the room Prat')
        expect(await roomIdOf(room)).toBeNull()

        homeserver.roomsRefusingEveryChange.length = 0
        await syncChat(homeserver)
        expect(homeserver.room(await roomIdOf(room)).name).toBe('Prat')
    })
})

describe('a private room of a space', () => {
    async function privateRoomWithKariPicked() {
        const kari = await createChatUser('kari')
        const ola = await createChatUser('ola')
        const space = await createSpace('Space', [kari, ola])
        const room = await prisma.chatSpaceRoom.create({
            data: {
                spaceId: space.id,
                name: 'Styret',
                isPrivate: true,
                pickedMembers: { create: { spaceMember: { connect: { spaceId_chatUserId: {
                    spaceId: space.id,
                    chatUserId: kari.chatUser.id,
                } } } } },
            },
        })
        await syncChat(homeserver)
        return { space, room, roomId: await roomIdOf(room), kari, ola }
    }

    test('has those picked for it, whom the sync puts there, and lets no one else in', async () => {
        const { roomId, kari, ola } = await privateRoomWithKariPicked()

        expect(homeserver.room(roomId).members).toEqual([homeserver.botUserId, kari.matrixId])
        expect(() => homeserver.join(roomId, ola.matrixId)).toThrow('may not let themselves in')
    })

    test('loses a member who is picked no longer, and one who got in past the application', async () => {
        const { room, roomId, ola } = await privateRoomWithKariPicked()
        homeserver.room(roomId).members.push(ola.matrixId)

        await prisma.chatSpaceRoomMember.deleteMany({ where: { roomId: room.id } })
        await syncChat(homeserver)

        expect(homeserver.room(roomId).members).toEqual([homeserver.botUserId])
    })

    test('loses a member who is removed from the space, and does not get them back with the space', async () => {
        const { space, roomId, kari } = await privateRoomWithKariPicked()

        await prisma.chatSpaceMember.deleteMany({ where: { chatUserId: kari.chatUser.id } })
        await syncChat(homeserver)
        expect(homeserver.room(roomId).members).toEqual([homeserver.botUserId])

        await prisma.chatSpaceMember.create({ data: { spaceId: space.id, chatUserId: kari.chatUser.id } })
        await syncChat(homeserver)
        expect(homeserver.room(roomId).members).toEqual([homeserver.botUserId])
    })

    async function pick(room: { id: number, spaceId: number }, chatUser: { id: number }) {
        const spaceMember = await prisma.chatSpaceMember.findUniqueOrThrow({
            where: { spaceId_chatUserId: { spaceId: room.spaceId, chatUserId: chatUser.id } },
        })
        await prisma.chatSpaceRoomMember.create({ data: { roomId: room.id, spaceMemberId: spaceMember.id } })
    }

    test('gets on a later run a picked member whose join failed', async () => {
        const { room, roomId, ola } = await privateRoomWithKariPicked()
        await pick(room, ola.chatUser)
        homeserver.changesRefusedOnce.push(`add ${ola.matrixId} to ${roomId}`)

        await expect(syncChat(homeserver)).rejects.toThrow(`add ${ola.matrixId} to ${roomId}`)
        expect(homeserver.room(roomId).invited).toEqual([ola.matrixId])

        await syncChat(homeserver)
        expect(homeserver.room(roomId).members).toContain(ola.matrixId)
        expect(homeserver.room(roomId).invited).toEqual([])
    })

    test('takes back the invitation of one whose join failed and who is picked no longer', async () => {
        const { room, roomId, ola } = await privateRoomWithKariPicked()
        await pick(room, ola.chatUser)
        homeserver.changesRefusedOnce.push(`add ${ola.matrixId} to ${roomId}`)
        await expect(syncChat(homeserver)).rejects.toThrow()

        await prisma.chatSpaceRoomMember.deleteMany({ where: { spaceMember: { chatUserId: ola.chatUser.id } } })
        await syncChat(homeserver)

        expect(homeserver.room(roomId).invited).toEqual([])
        expect(() => homeserver.join(roomId, ola.matrixId)).toThrow('may not let themselves in')
    })

    test('is left as it is by a run with nothing to change', async () => {
        await privateRoomWithKariPicked()

        const settled = homeserver.writes.length
        await syncChat(homeserver)
        expect(homeserver.writes).toHaveLength(settled)
    })
})

describe('a destroyed room', () => {
    async function roomWithKariInIt() {
        const kari = await createChatUser('kari')
        const space = await createSpace('Space', [kari])
        const room = await createRoom(space)
        await syncChat(homeserver)
        const roomId = await roomIdOf(room)
        homeserver.join(roomId, kari.matrixId)
        return { space, room, roomId, kari }
    }

    test('is unlisted, emptied, left by the bot and forgotten', async () => {
        const { space, room, roomId } = await roomWithKariInIt()

        await prisma.chatSpaceRoom.update({ where: { id: room.id }, ...markDestroyed })
        await syncChat(homeserver)

        expect(homeserver.room(await spaceRoomIdOf(space)).listedRoomIds).toEqual([])
        expect(homeserver.room(roomId).members).toEqual([])
        expect(await prisma.chatSpaceRoom.count()).toBe(0)
    })

    test('is closed before it is emptied, and keeps its row while it cannot be closed', async () => {
        const { room, roomId, kari } = await roomWithKariInIt()
        homeserver.changesRefusedOnce.push(`close ${roomId}`)

        await prisma.chatSpaceRoom.update({ where: { id: room.id }, ...markDestroyed })
        await expect(syncChat(homeserver)).rejects.toThrow(`close ${roomId}`)
        expect(homeserver.room(roomId).members).toContain(kari.matrixId)
        expect(await prisma.chatSpaceRoom.count()).toBe(1)

        const before = homeserver.writes.length
        await syncChat(homeserver)
        expect(homeserver.writes.slice(before)).toEqual([
            expect.stringContaining('unlist'),
            `close ${roomId}`,
            `remove ${kari.matrixId} from ${roomId}`,
            `leave ${roomId}`,
        ])
        expect(await prisma.chatSpaceRoom.count()).toBe(0)
    })

    test('lets nobody in on an invitation from before it was destroyed', async () => {
        const { room, roomId } = await roomWithKariInIt()
        const invited = homeserver.signIn('invited')
        homeserver.room(roomId).invited.push(invited)

        await prisma.chatSpaceRoom.update({ where: { id: room.id }, ...markDestroyed })
        await syncChat(homeserver)

        expect(homeserver.room(roomId).invited).toEqual([])
        expect(() => homeserver.join(roomId, invited)).toThrow('may not let themselves in')
    })

    test('that was never made on the homeserver is only forgotten', async () => {
        const space = await createSpace('Space')
        await prisma.chatSpaceRoom.create({ data: { spaceId: space.id, name: 'Prat', destroyedAt: new Date() } })
        await syncChat(homeserver)

        expect(homeserver.rooms.size).toBe(1)
        expect(await prisma.chatSpaceRoom.count()).toBe(0)
    })

    test('keeps its row while the homeserver will not let someone out of it', async () => {
        const { room, roomId, kari } = await roomWithKariInIt()
        homeserver.changesRefusedOnce.push(`remove ${kari.matrixId} from ${roomId}`)

        await prisma.chatSpaceRoom.update({ where: { id: room.id }, ...markDestroyed })
        await expect(syncChat(homeserver)).rejects.toThrow(`remove ${kari.matrixId} from ${roomId}`)

        expect(await prisma.chatSpaceRoom.count()).toBe(1)
    })

    test('that the bot could not leave lets no member of the space back in, and is left on a later run', async () => {
        const { room, roomId, kari } = await roomWithKariInIt()
        homeserver.changesRefusedOnce.push(`leave ${roomId}`)

        await prisma.chatSpaceRoom.update({ where: { id: room.id }, ...markDestroyed })
        await expect(syncChat(homeserver)).rejects.toThrow(`leave ${roomId}`)
        expect(homeserver.room(roomId).members).toEqual([homeserver.botUserId])
        expect(await prisma.chatSpaceRoom.count()).toBe(1)
        expect(() => homeserver.join(roomId, kari.matrixId)).toThrow('may not let themselves in')

        await syncChat(homeserver)
        expect(homeserver.room(roomId).members).toEqual([])
        expect(await prisma.chatSpaceRoom.count()).toBe(0)
    })
})

describe('a destroyed space', () => {
    test('is emptied, its rooms too, left by the bot and forgotten', async () => {
        const kari = await createChatUser('kari')
        const space = await createSpace('Space', [kari])
        const room = await createRoom(space)
        await syncChat(homeserver)
        const spaceRoomId = await spaceRoomIdOf(space)
        const roomId = await roomIdOf(room)
        homeserver.join(roomId, kari.matrixId)

        await prisma.chatSpace.update({ where: { id: space.id }, ...markDestroyed })
        await syncChat(homeserver)

        expect(homeserver.room(spaceRoomId).members).toEqual([])
        expect(homeserver.room(roomId).members).toEqual([])
        expect(await prisma.chatSpace.count()).toBe(0)
        expect(await prisma.chatSpaceRoom.count()).toBe(0)
        const channelIds = [space.mentionsNotificationChannelId, space.allNotificationChannelId]
        expect(await prisma.notificationChannel.count({ where: { id: { in: channelIds } } })).toBe(0)
    })

    test('that was never made on the homeserver is only forgotten', async () => {
        await createChatSpace({ name: 'Space', destroyed: true })
        await syncChat(homeserver)
        expect(homeserver.rooms.size).toBe(0)
        expect(await prisma.chatSpace.count()).toBe(0)
    })

    test('keeps its row while the homeserver will not let someone out of it', async () => {
        const kari = await createChatUser('kari')
        const space = await createSpace('Space', [kari])
        await syncChat(homeserver)
        const spaceRoomId = await spaceRoomIdOf(space)
        homeserver.roomsRefusingEveryChange.push(spaceRoomId)

        await prisma.chatSpace.update({ where: { id: space.id }, ...markDestroyed })
        await expect(syncChat(homeserver)).rejects.toThrow(`remove ${kari.matrixId} from ${spaceRoomId}`)
        expect(await prisma.chatSpace.count()).toBe(1)
    })

    test('keeps its row until every room of it is emptied, on a later run if need be', async () => {
        const kari = await createChatUser('kari')
        const space = await createSpace('Space', [kari])
        const room = await createRoom(space)
        await syncChat(homeserver)
        const roomId = await roomIdOf(room)
        homeserver.join(roomId, kari.matrixId)
        homeserver.changesRefusedOnce.push(`remove ${kari.matrixId} from ${roomId}`)

        await prisma.chatSpace.update({ where: { id: space.id }, ...markDestroyed })
        await expect(syncChat(homeserver)).rejects.toThrow(`remove ${kari.matrixId} from ${roomId}`)
        expect(await prisma.chatSpace.count()).toBe(1)

        await syncChat(homeserver)
        expect(homeserver.room(roomId).members).toEqual([])
        expect(await prisma.chatSpace.count()).toBe(0)
    })
})

describe('a change the homeserver refuses', () => {
    test('does not keep the rest of the run from being done, and is named when the run is through', async () => {
        const kari = await createChatUser('kari')
        const first = await createSpace('First', [kari])
        const second = await createSpace('Second', [kari])
        await syncChat(homeserver)
        homeserver.roomsRefusingEveryChange.push(await spaceRoomIdOf(first))

        await prisma.chatSpace.updateMany({ data: { name: 'Renamed' } })
        await expect(syncChat(homeserver)).rejects.toThrow('to Renamed')

        expect(homeserver.room(await spaceRoomIdOf(first)).name).toBe('First')
        expect(homeserver.room(await spaceRoomIdOf(second)).name).toBe('Renamed')
    })
})
