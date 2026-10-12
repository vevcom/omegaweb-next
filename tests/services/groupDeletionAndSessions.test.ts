import { Session } from '@/auth/session/Session'
import { prisma } from '@/prisma-pn-client-instance'
import { committeeOperations } from '@/services/groups/committees/operations'
import { manualGroupOperations } from '@/services/groups/manualGroups/operations'
import { userOperations } from '@/services/users/operations'
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

    test('a committee takes its group and paragraphs with it', async () => {
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
            where: { id: { in: [committee.paragraphId, committee.applicationParagraphId] } },
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
