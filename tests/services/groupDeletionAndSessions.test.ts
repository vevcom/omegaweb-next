import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { committeeOperations } from '@/services/groups/committees/operations'
import { manualGroupOperations } from '@/services/groups/manualGroups/operations'
import { studyProgrammeOperations } from '@/services/groups/studyProgrammes/operations'
import { userOperations } from '@/services/users/operations'
import { userPrivateSelection } from '@/services/users/constants'
import { describe, expect, test } from '@jest/globals'
import type { Permission } from '@/prisma-generated-pn-types'

let counter = 0

async function createUser() {
    const username = `gruppe-sletting-${++counter}`
    return prisma.user.create({
        data: {
            username,
            email: `${username}@example.com`,
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
    })
}

function sessionWith(permissions: Permission[]) {
    return Session.fromJsObject({ memberships: [], permissions, user: null })
}

async function addMember(groupId: number, userId: number) {
    const { order } = await prisma.group.findUniqueOrThrow({ where: { id: groupId } })
    await prisma.membership.create({ data: { groupId, userId, order, admin: false, active: true } })
}

async function createCommittee() {
    const session = sessionWith(['COMMITTEE_ADMIN'])
    const committee = await committeeOperations.create({
        data: { name: `Komité med fortid ${++counter}`, shortName: `fortid-${counter}` },
        session,
    })
    const { order } = await prisma.group.findUniqueOrThrow({ where: { id: committee.groupId } })
    return { groupId: committee.groupId, order, session }
}

/** The session of a user holding the membership given, and no permission. */
async function sessionHolding(membership: { groupId: number, admin: boolean, order: number }) {
    const { id } = await createUser()
    const user = await prisma.user.findUniqueOrThrow({ where: { id }, select: userPrivateSelection })
    return Session.fromJsObject({ user, permissions: [], memberships: [{ ...membership, active: true }] })
}

async function updatedAtOf(userId: number) {
    return (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).updatedAt.getTime()
}

describe('deleting a group', () => {
    test('a manual group invalidates the sessions of its members', async () => {
        const session = sessionWith(['MANUAL_GROUP_ADMIN'])
        const manualGroup = await manualGroupOperations.create({
            data: { name: `Gruppe som slettes ${++counter}`, shortName: `slettes-${counter}` },
            session,
        })
        const member = await createUser()
        await addMember(manualGroup.groupId, member.id)
        const before = await updatedAtOf(member.id)

        await manualGroupOperations.destroy({ params: { id: manualGroup.id }, session })

        expect(await prisma.group.count({ where: { id: manualGroup.groupId } })).toBe(0)
        expect(await updatedAtOf(member.id)).toBeGreaterThan(before)
    })

    test('a committee takes its group and paragraph with it', async () => {
        const session = sessionWith(['COMMITTEE_ADMIN'])
        const committee = await committeeOperations.create({
            data: { name: `Komité som slettes ${++counter}`, shortName: `komite-${counter}` },
            session,
        })
        const member = await createUser()
        await addMember(committee.groupId, member.id)
        const before = await updatedAtOf(member.id)

        await committeeOperations.destroy({ params: { id: committee.id }, session })

        expect(await prisma.group.count({ where: { id: committee.groupId } })).toBe(0)
        expect(await prisma.membership.count({ where: { userId: member.id } })).toBe(0)
        expect(await prisma.cmsParagraph.count({
            where: { id: committee.paragraphId },
        })).toBe(0)
        expect(await updatedAtOf(member.id)).toBeGreaterThan(before)
    })
})

describe('re-adding a removed member', () => {
    test('takes the admin flag asked for now', async () => {
        const session = sessionWith(['MANUAL_GROUP_ADMIN', 'PERMISSION_ADMIN'])
        const manualGroup = await manualGroupOperations.create({
            data: { name: `Gruppe med gammel leder ${++counter}`, shortName: `gammel-leder-${counter}` },
            session,
        })
        const member = await createUser()
        const params = { groupId: manualGroup.groupId }

        await manualGroupOperations.addMembers({ params, data: { users: [{ userId: member.id, admin: true }] }, session })
        await manualGroupOperations.removeMembers({ params, data: { userIds: [member.id] }, session })
        await manualGroupOperations.addMembers({ params, data: { users: [{ userId: member.id, admin: false }] }, session })

        const membership = await prisma.membership.findFirstOrThrow({
            where: { groupId: manualGroup.groupId, userId: member.id },
        })
        expect(membership).toMatchObject({ active: true, admin: false })
    })
})

describe('deleting a membership', () => {
    test('of a committee\'s past order takes it out of the committee\'s history and leaves the rest', async () => {
        const { groupId, order, session } = await createCommittee()
        const [wrong, right] = [await createUser(), await createUser()]
        await committeeOperations.addMembers({
            params: { groupId, order: order - 1 },
            data: { users: [{ userId: wrong.id, admin: false }, { userId: right.id, admin: false }] },
            session,
        })
        await committeeOperations.addMembers({
            params: { groupId },
            data: { users: [{ userId: wrong.id, admin: false }] },
            session,
        })
        const before = await updatedAtOf(wrong.id)

        await committeeOperations.destroyMembership({
            params: { groupId, order: order - 1 },
            data: { userId: wrong.id },
            session,
        })

        const history = await committeeOperations.readMembers({ params: { groupId }, bypassAuth: true })
        expect(history.map(membership => [membership.user.id, membership.order])).toEqual(expect.arrayContaining([
            [right.id, order - 1],
            [wrong.id, order],
        ]))
        expect(history).toHaveLength(2)
        expect(await updatedAtOf(wrong.id)).toBeGreaterThan(before)
    })

    test('of a committee is refused to a visitor, a member, another committee\'s admin, and when pensioned', async () => {
        const { groupId, order, session } = await createCommittee()
        const other = await createCommittee()
        const member = await createUser()
        await committeeOperations.addMembers({
            params: { groupId },
            data: { users: [{ userId: member.id, admin: false }] },
            session,
        })
        const params = { groupId }
        const data = { userId: member.id }

        for (const refused of [
            Session.empty(),
            await sessionHolding({ groupId, admin: false, order }),
            await sessionHolding({ groupId: other.groupId, admin: true, order }),
        ]) {
            await expect(committeeOperations.destroyMembership({ params, data, session: refused }))
                .rejects.toThrow(Smorekopp)
        }
        await committeeOperations.pension({ params: { groupId }, data: { pensioned: true }, session })
        await expect(committeeOperations.destroyMembership({ params, data, session })).rejects.toThrow(Smorekopp)
        expect(await prisma.membership.count({ where: { groupId } })).toBe(1)
    })

    test('of a study programme, which follows Omega\'s order, takes that order\'s alone', async () => {
        const session = sessionWith(['STUDY_PROGRAMME_ADMIN'])
        const { groupId } = await studyProgrammeOperations.create({
            data: { name: `Studie ${++counter}`, code: `STUDIE${counter}` },
            session,
        })
        const { order } = await prisma.group.findUniqueOrThrow({ where: { id: groupId } })
        const member = await createUser()
        for (const atOrder of [order - 1, order]) {
            await studyProgrammeOperations.addMembers({
                params: { groupId, order: atOrder },
                data: { users: [{ userId: member.id, admin: false }] },
                session,
            })
        }

        await studyProgrammeOperations.destroyMembership({
            params: { groupId, order: order - 1 },
            data: { userId: member.id },
            session,
        })

        expect(await prisma.membership.findMany({ where: { groupId }, select: { order: true, active: true } }))
            .toEqual([{ order, active: true }])
    })
})

describe('changing the password', () => {
    test('bumps the session epoch', async () => {
        const user = await createUser()
        await prisma.credentials.create({
            data: { userId: user.id, username: user.username, email: user.email, passwordHash: 'gammel' },
        })

        await userOperations.updatePassword({
            params: { id: user.id },
            data: { password: 'et-nytt-passord-123', confirmPassword: 'et-nytt-passord-123' },
            bypassAuth: true,
        })

        expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).sessionEpoch).toBe(1)
    })
})
