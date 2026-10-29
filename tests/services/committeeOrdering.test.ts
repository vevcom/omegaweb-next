import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { committeeOperations } from '@/services/groups/committees/operations'
import { afterEach, describe, expect, test } from '@jest/globals'

const session = Session.fromJsObject({
    memberships: [],
    permissions: ['COMMITTEE_ADMIN', 'COMMITTEE_USE'],
    user: null,
})

const createdCommitteeIds: number[] = []

async function createCommittee(shortName: string) {
    const committee = await committeeOperations.create({
        data: { name: `Komité ${shortName}`, shortName },
        session,
    })
    createdCommitteeIds.push(committee.id)
    return committee
}

async function createUsers(prefix: string, count: number) {
    return Promise.all(Array.from({ length: count }, (_, index) => prisma.user.create({
        data: {
            username: `ordering-${prefix}-${index}`,
            email: `ordering-${prefix}-${index}@omega.ntnu.no`,
            firstname: `Bruker ${index}`,
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
    })))
}

async function readActiveCommitteeIdsInOrder() {
    const committees = await prisma.committee.findMany({
        where: { group: { pensioned: false } },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        select: { id: true },
    })
    return committees.map(committee => committee.id)
}

afterEach(async () => {
    await Promise.all(createdCommitteeIds.splice(0).map(id => committeeOperations.destroy({
        params: { id },
        session,
    })))
    await prisma.user.deleteMany({ where: { username: { startsWith: 'ordering-' } } })
})

describe('ordering committees', () => {
    test('a new committee is listed last', async () => {
        const first = await createCommittee('rekke-forst')
        const second = await createCommittee('rekke-sist')

        const ids = await readActiveCommitteeIdsInOrder()
        expect(ids.slice(-2)).toEqual([first.id, second.id])
    })

    test('reordering sets the order committees are listed in', async () => {
        await createCommittee('rekke-a')
        await createCommittee('rekke-b')

        const reversed = (await readActiveCommitteeIdsInOrder()).reverse()
        await committeeOperations.reorder({ data: { committeeIds: reversed }, session })

        expect(await readActiveCommitteeIdsInOrder()).toEqual(reversed)
    })

    test('a list missing a committee is refused', async () => {
        await createCommittee('rekke-c')
        await createCommittee('rekke-d')

        const ids = await readActiveCommitteeIdsInOrder()
        const reorder = committeeOperations.reorder({ data: { committeeIds: ids.slice(1) }, session })
        await expect(reorder).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        expect(await readActiveCommitteeIdsInOrder()).toEqual(ids)
    })

    test('reordering needs COMMITTEE_ADMIN', async () => {
        const reorder = committeeOperations.reorder({
            data: { committeeIds: await readActiveCommitteeIdsInOrder() },
            session: Session.fromJsObject({ memberships: [], permissions: ['COMMITTEE_USE'], user: null }),
        })
        await expect(reorder).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))
    })
})

describe('ordering committee members', () => {
    test('members are added last and read back in the order they were given', async () => {
        const committee = await createCommittee('medlemsrekke')
        const users = await createUsers('rekke', 3)
        const userIds = users.map(user => user.id)

        await committeeOperations.addMembers({
            params: { groupId: committee.groupId },
            data: { users: userIds.map(userId => ({ userId, admin: false })) },
            session,
        })
        const readUserIds = async () => (await committeeOperations.readMembers({
            params: { groupId: committee.groupId },
            bypassAuth: true,
        })).map(member => member.userId)
        expect(await readUserIds()).toEqual(userIds)

        const reordered = [userIds[2], userIds[0], userIds[1]]
        await committeeOperations.reorderMembers({
            params: { groupId: committee.groupId },
            data: { userIds: reordered },
            session,
        })
        expect(await readUserIds()).toEqual(reordered)

        const stale = committeeOperations.reorderMembers({
            params: { groupId: committee.groupId },
            data: { userIds: reordered.slice(1) },
            session,
        })
        await expect(stale).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        expect(await readUserIds()).toEqual(reordered)
    })
})
