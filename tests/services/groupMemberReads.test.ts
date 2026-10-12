import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { manualGroupOperations } from '@/services/groups/manualGroups/operations'
import { classOperations } from '@/services/groups/classes/operations'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { userPrivateSelection } from '@/services/users/constants'
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'
import type { UserFiltered } from '@/services/users/types'

const adminSession = Session.fromJsObject({
    memberships: [],
    permissions: ['MANUAL_GROUP_ADMIN'],
    user: null,
})

let groupId: number
let userId: number
let user: UserFiltered

/**
 * A logged-in user holding only the default permissions. `MANUAL_GROUP_USE` and `CLASS_USE` are
 * among them, which is the reason member reads take `USERS_USE` on top.
 */
function sessionOfVisitor() {
    return Session.fromJsObject({
        memberships: [],
        permissions: ['MANUAL_GROUP_USE', 'CLASS_USE'],
        user,
    })
}

beforeEach(async () => {
    const manualGroup = await manualGroupOperations.create({
        data: { name: 'Gruppe med leder', shortName: 'leder-test' },
        session: adminSession,
    })
    groupId = manualGroup.groupId

    const { order } = await omegaOrderOperations.readCurrent({ bypassAuth: true })
    const created = await prisma.user.create({
        data: {
            username: 'group-admin-test',
            email: 'group-admin-test@omega.ntnu.no',
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
        select: userPrivateSelection,
    })
    user = created
    userId = created.id
    await prisma.membership.create({
        data: { groupId, userId, order, active: true, admin: true },
    })
})

afterEach(async () => {
    await prisma.membership.deleteMany()
    await prisma.manualGroup.deleteMany()
    await prisma.group.deleteMany({ where: { groupType: 'MANUAL_GROUP' } })
    await prisma.user.deleteMany({ where: { username: 'group-admin-test' } })
})

/** The group's own admin, as their session looks once the membership is in the JWT. */
function sessionOfGroupAdmin() {
    return Session.fromJsObject({
        memberships: [{ groupId, admin: true, active: true, order: 0 }],
        permissions: ['MANUAL_GROUP_USE'],
        user,
    })
}

describe('reading the members of a managed group', () => {
    test('a group admin may read the members they manage', async () => {
        const members = await manualGroupOperations.readMembers({
            params: { groupId },
            session: sessionOfGroupAdmin(),
        })
        expect(members.map(member => member.userId)).toContain(userId)
    })

    test('the group permission alone is not enough - it takes USERS_USE too', async () => {
        const read = manualGroupOperations.readMembers({
            params: { groupId },
            session: sessionOfVisitor(),
        })
        await expect(read).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
    })

    test('being admin of one group does not open another', async () => {
        const otherGroup = await manualGroupOperations.create({
            data: { name: 'Annen gruppe', shortName: 'annen-test' },
            session: adminSession,
        })

        const read = manualGroupOperations.readMembers({
            params: { groupId: otherGroup.groupId },
            session: sessionOfGroupAdmin(),
        })
        await expect(read).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
    })

    test('classes keep the permission-only authorizer, so a default read is not a roster', async () => {
        const classGroup = await prisma.class.findFirstOrThrow({ select: { groupId: true } })

        const read = classOperations.readMembers({
            params: { groupId: classGroup.groupId },
            session: sessionOfVisitor(),
        })
        await expect(read).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
    })
})
