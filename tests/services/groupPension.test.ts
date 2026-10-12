import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { manualGroupOperations } from '@/services/groups/manualGroups/operations'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { afterEach, describe, expect, test } from '@jest/globals'

const session = Session.fromJsObject({
    memberships: [],
    permissions: ['MANUAL_GROUP_ADMIN'],
    user: null,
})

/**
 * A manual group sitting one order behind omega with one active member there - a group that has not
 * been migrated yet, and has not been pensioned either.
 */
async function createGroupBehindCurrentOrder(shortName: string) {
    const { order: currentOrder } = await omegaOrderOperations.readCurrent({ bypassAuth: true })

    const manualGroup = await manualGroupOperations.create({
        data: { name: `Gruppe ${shortName}`, shortName },
        session,
    })

    const user = await prisma.user.create({
        data: {
            username: `pension-${shortName}`,
            email: `pension-${shortName}@omega.ntnu.no`,
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
    })

    await prisma.group.update({
        where: { id: manualGroup.groupId },
        data: { order: currentOrder - 1 },
    })
    await prisma.membership.create({
        data: {
            groupId: manualGroup.groupId,
            userId: user.id,
            order: currentOrder - 1,
            active: true,
            admin: true,
        },
    })

    return { ...manualGroup, currentOrder, userId: user.id }
}

afterEach(async () => {
    await prisma.membership.deleteMany()
    await prisma.manualGroup.deleteMany()
    await prisma.group.deleteMany({ where: { groupType: 'MANUAL_GROUP' } })
    await prisma.user.deleteMany({ where: { username: { startsWith: 'pension-' } } })
})

describe('pensioning groups', () => {
    test('a group that is not pensioned cannot be restored', async () => {
        const { groupId, currentOrder } = await createGroupBehindCurrentOrder('ikke-pensjonert')

        const restore = manualGroupOperations.pension({
            params: { groupId },
            data: { pensioned: false },
            session,
        })
        await expect(restore).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))

        // The group must not have been pulled up to the current order behind its own memberships.
        const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId } })
        expect(group.order).toEqual(currentOrder - 1)
        expect(await prisma.membership.count({
            where: { groupId, active: true, order: { lt: group.order } },
        })).toEqual(0)
    })

    test('pensioning ends the memberships, and restoring brings the group to the current order', async () => {
        const { groupId, currentOrder } = await createGroupBehindCurrentOrder('pensjonert')

        await manualGroupOperations.pension({
            params: { groupId },
            data: { pensioned: true },
            session,
        })

        expect(await prisma.manualGroup.findUniqueOrThrow({ where: { groupId } }))
            .toMatchObject({ pensioned: true })
        expect(await prisma.membership.count({ where: { groupId, active: true } })).toEqual(0)

        await manualGroupOperations.pension({
            params: { groupId },
            data: { pensioned: false },
            session,
        })

        expect(await prisma.manualGroup.findUniqueOrThrow({ where: { groupId } }))
            .toMatchObject({ pensioned: false })
        expect(await prisma.group.findUniqueOrThrow({ where: { id: groupId } }))
            .toMatchObject({ order: currentOrder })
        expect(await prisma.membership.count({ where: { groupId, active: true } })).toEqual(0)
    })

    test('pensioning invalidates the sessions of the members it removes', async () => {
        const { groupId, userId } = await createGroupBehindCurrentOrder('sesjoner')

        const before = await prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { updatedAt: true },
        })

        await manualGroupOperations.pension({
            params: { groupId },
            data: { pensioned: true },
            session,
        })

        // A JWT issued before this carries the membership as active, so it has to be rejected.
        const after = await prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { updatedAt: true },
        })
        expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime())
    })
})
