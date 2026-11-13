import { FakeHomeserver } from 'tests/fakeHomeserver'
import { testSession } from 'tests/utils'
import { syncChat } from '@/lib/chatSync/sync'
import { ROOM_MODERATOR_LEVEL } from '@/lib/chatSync/constants'
import { committeeChatSpaceOperations } from '@/services/groups/committees/chatSpace'
import { committeeOperations } from '@/services/groups/committees/operations'
import { userOperations } from '@/services/users/operations'
import { prisma } from '@/prisma-pn-client-instance'
import { afterEach, describe, expect, test } from '@jest/globals'

const committeeAdmins = testSession({ permissions: ['COMMITTEE_ADMIN'] })
let created = 0

async function createCommittee() {
    const shortName = `chat-komite-${++created}`
    return committeeOperations.create({ data: { name: `Komité ${created}`, shortName }, session: committeeAdmins })
}

async function createMember(
    committee: { groupId: number },
    username: string,
    { active = true, admin = false, chatAccount = true } = {},
) {
    const { id } = await prisma.user.create({
        data: {
            username,
            email: `${username}@committee-chat.test`,
            firstname: 'Kari',
            lastname: username,
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
            ...(chatAccount ? { chatUser: { create: { localpart: username } } } : {}),
        },
    })
    const { order } = await prisma.group.findUniqueOrThrow({ where: { id: committee.groupId } })
    const membership = await prisma.membership.create({
        data: { groupId: committee.groupId, userId: id, order, active, admin },
    })
    const user = await userOperations.read({ params: { id }, bypassAuth: true })
    return { user, session: testSession({ user, memberships: [membership] }) }
}

const ofCommittee = (committee: { groupId: number }) => ({ params: { groupId: committee.groupId } })
const inSpaceOf = (committee: { groupId: number }, space: { id: number }) => ({
    implementationParams: { groupId: committee.groupId },
    params: { spaceId: space.id },
})

afterEach(async () => {
    await prisma.chatSpace.deleteMany()
    await prisma.chatUser.deleteMany()
    await prisma.user.deleteMany({ where: { email: { endsWith: '@committee-chat.test' } } })
})

describe('the chat space of a committee', () => {
    test('is made by an admin of the committee or a committee admin, named for it, and one at a time', async () => {
        const committee = await createCommittee()
        const leader = await createMember(committee, 'leder', { admin: true })
        const member = await createMember(committee, 'medlem')

        await expect(committeeChatSpaceOperations.create({ ...ofCommittee(committee), session: member.session }))
            .rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })

        const space = await committeeChatSpaceOperations.create({ ...ofCommittee(committee), session: leader.session })
        expect(space).toMatchObject({ purpose: 'COMMITTEE', name: committee.name })
        await expect(committeeChatSpaceOperations.create({ ...ofCommittee(committee), session: committeeAdmins }))
            .rejects.toMatchObject({ errorCode: 'BAD DATA' })
        expect(await prisma.chatSpace.count()).toBe(1)
    })

    test('has the active members by themselves, and the active admins moderate its rooms', async () => {
        const homeserver = new FakeHomeserver()
        const committee = await createCommittee()
        const leader = await createMember(committee, 'leder', { admin: true })
        await createMember(committee, 'medlem')
        await createMember(committee, 'pang', { active: false })
        const anotherCommittee = await createCommittee()
        await createMember(anotherCommittee, 'annen')
        for (const localpart of ['leder', 'medlem', 'pang', 'annen']) homeserver.signIn(localpart)

        const space = await committeeChatSpaceOperations.create({ ...ofCommittee(committee), session: leader.session })
        const room = await committeeChatSpaceOperations.createRoom(
            { ...inSpaceOf(committee, space), data: { name: 'Prat', isPrivate: false }, session: leader.session },
        )
        await syncChat(homeserver)
        await syncChat(homeserver)

        const { matrixRoomId: spaceRoomId } = await prisma.chatSpace.findUniqueOrThrow({ where: { id: space.id } })
        const { matrixRoomId: roomId } = await prisma.chatSpaceRoom.findUniqueOrThrow({ where: { id: room.id } })
        expect(homeserver.room(spaceRoomId!).members.sort()).toEqual(
            [homeserver.botUserId, homeserver.userIdOf('leder'), homeserver.userIdOf('medlem')].sort(),
        )
        expect(homeserver.room(roomId!).levels.users).toEqual({ [homeserver.userIdOf('leder')]: ROOM_MODERATOR_LEVEL })
    })

    test('tells who is in it among the active, the inactive and those outside the committee', async () => {
        const committee = await createCommittee()
        const leader = await createMember(committee, 'leder', { admin: true })
        const withoutAccount = await createMember(committee, 'uten-konto', { chatAccount: false })
        const inactive = await createMember(committee, 'pang', { active: false })
        const outsider = await createMember(await createCommittee(), 'utenfra')
        const space = await committeeChatSpaceOperations.create({ ...ofCommittee(committee), session: leader.session })

        await committeeChatSpaceOperations.addMembers({
            ...inSpaceOf(committee, space),
            data: { userIds: [inactive.user.id, outsider.user.id] },
            session: leader.session,
        })
        const overview = await committeeChatSpaceOperations.read({ ...ofCommittee(committee), session: leader.session })

        expect(overview?.space).toMatchObject({ id: space.id, onHomeserver: false })
        expect(overview?.people).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: leader.user.id, standing: 'ACTIVE', isInSpace: false, hasChatAccount: true }),
            expect.objectContaining({ id: withoutAccount.user.id, standing: 'ACTIVE', hasChatAccount: false }),
            expect.objectContaining({ id: inactive.user.id, standing: 'INACTIVE', isInSpace: true }),
            expect.objectContaining({ id: outsider.user.id, standing: 'OUTSIDE', isInSpace: true, latestOrder: null }),
        ]))
        expect(overview?.people).toHaveLength(4)
    })

    test('is another committee\'s admins\' to leave alone', async () => {
        const committee = await createCommittee()
        const leader = await createMember(committee, 'leder', { admin: true })
        const anotherCommittee = await createCommittee()
        const anotherLeader = await createMember(anotherCommittee, 'annen-leder', { admin: true })
        const space = await committeeChatSpaceOperations.create({ ...ofCommittee(committee), session: leader.session })

        await expect(committeeChatSpaceOperations.destroy({
            ...inSpaceOf(committee, space),
            session: anotherLeader.session,
        })).rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
        await expect(committeeChatSpaceOperations.destroy({
            ...inSpaceOf(anotherCommittee, space),
            session: anotherLeader.session,
        })).rejects.toMatchObject({ errorCode: 'DISSALLOWED' })
    })

    test('is renamed with its committee, and makes room for a new one once it is destroyed', async () => {
        const committee = await createCommittee()
        const space = await committeeChatSpaceOperations.create({ ...ofCommittee(committee), session: committeeAdmins })

        await committeeOperations.update({
            params: { id: committee.id },
            data: { name: 'Nytt navn' },
            session: committeeAdmins,
        })
        expect(await prisma.chatSpace.findUniqueOrThrow({ where: { id: space.id } })).toMatchObject({ name: 'Nytt navn' })

        await committeeChatSpaceOperations.destroy({ ...inSpaceOf(committee, space), session: committeeAdmins })
        await expect(committeeChatSpaceOperations.read({ ...ofCommittee(committee), session: committeeAdmins }))
            .resolves.toBeNull()
        const next = await committeeChatSpaceOperations.create({ ...ofCommittee(committee), session: committeeAdmins })
        expect(next.id).not.toBe(space.id)
    })

    test('is destroyed with its committee', async () => {
        const committee = await createCommittee()
        const space = await committeeChatSpaceOperations.create({ ...ofCommittee(committee), session: committeeAdmins })

        await committeeOperations.destroy({ params: { id: committee.id }, session: committeeAdmins })

        expect(await prisma.chatSpace.findUniqueOrThrow({ where: { id: space.id } }))
            .toMatchObject({ destroyedAt: expect.any(Date) })
    })
})
