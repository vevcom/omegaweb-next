import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { revueOperations } from '@/services/revue/operations'
import { revueGroupOperations } from '@/services/revue/groups/operations'
import { revueSubGroupOperations } from '@/services/groups/revueSubGroups/operations'
import { committeeOperations } from '@/services/groups/committees/operations'
import { readExpandedOfAllTypes } from '@/services/groups/readExpandedOfAllTypes'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { userPrivateSelection } from '@/services/users/constants'
import { defaultRevuePalette } from '@/app/(revue)/_lib/revueTheme'
import { afterEach, beforeAll, describe, expect, test } from '@jest/globals'

const revueAdmin = Session.fromJsObject({ user: null, permissions: ['REVUE_ADMIN', 'USERS_USE'], memberships: [] })
const committeeAdmin = Session.fromJsObject({ user: null, permissions: ['COMMITTEE_ADMIN'], memberships: [] })

let currentOrder: number

beforeAll(async () => {
    currentOrder = (await omegaOrderOperations.readCurrent({ bypassAuth: true })).order
})

afterEach(async () => {
    const revueGroups = await prisma.revueGroup.findMany({
        select: { id: true, revueSubGroup: { select: { group: { select: { id: true, pensioned: true } } } } },
    })
    for (const revueGroup of revueGroups) {
        const group = revueGroup.revueSubGroup?.group
        if (group?.pensioned) {
            await revueSubGroupOperations.pension({
                params: { groupId: group.id },
                data: { pensioned: false },
                session: revueAdmin,
            })
        }
        await revueGroupOperations.destroy({ params: { revueGroupId: revueGroup.id }, session: revueAdmin })
    }
    const revues = await prisma.revue.findMany({ select: { id: true } })
    for (const revue of revues) {
        await revueOperations.destroy({ params: { revueId: revue.id }, session: revueAdmin })
    }
    const committees = await prisma.committee.findMany({
        where: { shortName: { startsWith: 'revue-test' } },
        include: { group: { select: { pensioned: true } } },
    })
    for (const committee of committees) {
        if (committee.group.pensioned) {
            await committeeOperations.pension({
                params: { groupId: committee.groupId },
                data: { pensioned: false },
                session: committeeAdmin,
            })
        }
        await committeeOperations.destroy({ params: { id: committee.id }, session: committeeAdmin })
    }
    await prisma.user.deleteMany({ where: { username: { startsWith: 'revue-test' } } })
})

describe('creating a revue group', () => {
    test('of a sub group makes the sub group, its group at Omega\'s order and its place in the revue', async () => {
        const revue = await createRevue(2026)
        const revueGroup = await createSubGroup(revue.id, 'Band')

        const made = await prisma.revueGroup.findUniqueOrThrow({
            where: { id: revueGroup.id },
            include: { revueSubGroup: { include: { group: true } }, articleSection: true, revues: true },
        })
        expect(made.type).toBe('REVUE_SUB_GROUP')
        expect(made.committeeId).toBeNull()
        expect(made.revueSubGroup?.group).toMatchObject({ groupType: 'REVUE_SUB_GROUP', order: currentOrder })
        expect(made.revues).toEqual([{ revueId: revue.id, revueGroupId: revueGroup.id, order: currentOrder }])
    })

    test('of a committee points at the committee, makes no group of its own and is in no revue', async () => {
        const committee = await createCommittee()
        const groupCount = await prisma.group.count()

        const revueGroup = await revueGroupOperations.create({
            params: {},
            data: { type: 'COMMITTEE', name: 'Styret', committeeId: committee.id },
            session: revueAdmin,
        })

        expect(revueGroup).toMatchObject({ type: 'COMMITTEE', committeeId: committee.id, revueSubGroupId: null })
        expect(await prisma.group.count()).toBe(groupCount)
        expect(await prisma.revueGroupInRevue.count()).toBe(0)
    })

    test('of a committee that is a revue group already is refused, saying which', async () => {
        const committee = await createCommittee()
        const create = (name: string) => revueGroupOperations.create({
            params: {},
            data: { type: 'COMMITTEE', name, committeeId: committee.id },
            session: revueAdmin,
        })
        await create('Styret')

        await expect(create('Styret igjen')).rejects.toMatchObject({
            errorCode: 'DUPLICATE',
            errors: [{ message: 'Revystyret er allerede revygruppen Styret' }],
        })
    })

    test('is for a revue admin alone', async () => {
        const revue = await createRevue(2026)
        await expect(revueGroupOperations.create({
            params: { revueId: revue.id },
            data: { type: 'REVUE_SUB_GROUP', name: 'Band' },
            session: Session.empty(),
        })).rejects.toThrow(Smorekopp)
    })
})

describe('a revue group in a revue', () => {
    test('is put in at an order Omega has, and taken out again', async () => {
        const committee = await createCommittee()
        const { id } = await revueGroupOperations.create({
            params: {},
            data: { type: 'COMMITTEE', name: 'Styret', committeeId: committee.id },
            session: revueAdmin,
        })
        const revue = await createRevue(2026)
        const addToRevue = (order: number) => revueGroupOperations.addToRevue({
            params: { revueId: revue.id },
            data: { revueGroupId: id, order },
            session: revueAdmin,
        })

        await expect(addToRevue(currentOrder + 1)).rejects.toMatchObject({
            errors: [{ message: `Omega har ingen orden ${currentOrder + 1}` }],
        })
        await addToRevue(currentOrder)
        expect(await memberNames(2026, 'Styret')).toEqual([])

        await revueGroupOperations.removeFromRevue({
            params: { revueId: revue.id, revueGroupId: id },
            session: revueAdmin,
        })
        expect(await prisma.revueGroupInRevue.count()).toBe(0)
        expect(await prisma.revueGroup.count()).toBe(1)
    })
})

describe('migrating a revue sub group', () => {
    test('leaves its last revue with the members of the order it left, and puts it in no revue', async () => {
        const revue = await createRevue(2025)
        const { groupId } = await createSubGroupWithGroupId(revue.id, 'Band', currentOrder - 1)
        await prisma.group.update({ where: { id: groupId }, data: { order: currentOrder - 1 } })
        const [kari, ola] = await createUsers('Kari', 'Ola')
        await addMembers(groupId, currentOrder - 1, [kari, ola])

        await expect(revueSubGroupOperations.migrateGroup({
            params: { groupId },
            data: { keep: [{ userId: kari.id, admin: true }] },
            session: sessionOfAdminOf(kari, groupId),
        })).rejects.toThrow(Smorekopp)
        await revueSubGroupOperations.migrateGroup({
            params: { groupId },
            data: { keep: [{ userId: kari.id, admin: true }] },
            session: revueAdmin,
        })

        const group = await revueGroupOperations.readInRevue({
            params: { year: 2025, name: 'Band' },
            session: Session.empty(),
        })
        expect(group.members.map(member => member.name)).toEqual(['Kari Nordmann', 'Ola Nordmann'])
        expect(group.group.order).toBe(currentOrder)
        expect(await prisma.revueGroupInRevue.findMany({ select: { order: true } }))
            .toEqual([{ order: currentOrder - 1 }])
    })
})

describe('the members of a revue group in a revue', () => {
    test('are the active members of the group\'s order while the group stands in it', async () => {
        const revue = await createRevue(2026)
        const { groupId } = await createSubGroupWithGroupId(revue.id, 'Band')
        const [kari, ola, removed, archived] = await createUsers('Kari', 'Ola', 'Fjernet', 'Arkivert')
        await addMembers(groupId, currentOrder, [kari, ola, removed, archived])
        await revueSubGroupOperations.removeMembers({
            params: { groupId },
            data: { userIds: [removed.id] },
            session: revueAdmin,
        })
        await prisma.user.update({ where: { id: archived.id }, data: { archived: true } })

        expect(await memberNames(2026, 'Band')).toEqual(['Kari Nordmann', 'Ola Nordmann'])
    })

    test('are every member of an order the group has moved past', async () => {
        const revue = await createRevue(2025)
        const { id, groupId } = await createSubGroupWithGroupId(revue.id, 'Band', currentOrder - 1)
        const [kari, ola] = await createUsers('Kari', 'Ola')
        await addMembers(groupId, currentOrder - 1, [kari, ola])
        await addMembers(groupId, currentOrder, [ola])

        expect(await memberNames(2025, 'Band')).toEqual(['Kari Nordmann', 'Ola Nordmann'])
        const [listed] = await revueGroupOperations.readManyInRevue({
            params: { revueId: revue.id },
            session: Session.empty(),
        })
        expect(listed).toMatchObject({ id, memberCount: 2 })
    })

    test('are in the order their group lists them in', async () => {
        const revue = await createRevue(2026)
        const { groupId } = await createSubGroupWithGroupId(revue.id, 'Band')
        const [kari, ola] = await createUsers('Kari', 'Ola')
        await addMembers(groupId, currentOrder, [kari, ola])
        await revueSubGroupOperations.reorderMembers({
            params: { groupId },
            data: { userIds: [ola.id, kari.id] },
            session: revueAdmin,
        })

        expect(await memberNames(2026, 'Band')).toEqual(['Ola Nordmann', 'Kari Nordmann'])
    })

    test('of a committee in a revue at an order above the committee\'s are none', async () => {
        const committee = await createCommittee()
        await prisma.group.update({ where: { id: committee.groupId }, data: { order: currentOrder - 1 } })
        const [kari] = await createUsers('Kari')
        await committeeOperations.addMembers({
            params: { groupId: committee.groupId },
            data: { users: [{ userId: kari.id, admin: true }] },
            session: committeeAdmin,
        })
        const revue = await createRevue(2026)
        await revueGroupOperations.create({
            params: { revueId: revue.id },
            data: { type: 'COMMITTEE', name: 'Styret', committeeId: committee.id },
            session: revueAdmin,
        })

        expect(await memberNames(2026, 'Styret')).toEqual([])
    })

    test('of a group pensioned in the revue\'s order are every member of that order', async () => {
        const committee = await createCommittee()
        const [kari, ola] = await createUsers('Kari', 'Ola')
        await committeeOperations.addMembers({
            params: { groupId: committee.groupId },
            data: { users: [{ userId: kari.id, admin: true }, { userId: ola.id, admin: false }] },
            session: committeeAdmin,
        })
        const revue = await createRevue(2026)
        const { id } = await revueGroupOperations.create({
            params: { revueId: revue.id },
            data: { type: 'COMMITTEE', name: 'Styret', committeeId: committee.id },
            session: revueAdmin,
        })

        await committeeOperations.pension({
            params: { groupId: committee.groupId },
            data: { pensioned: true },
            session: committeeAdmin,
        })

        expect(await memberNames(2026, 'Styret')).toEqual(['Kari Nordmann', 'Ola Nordmann'])
        const [listed] = await revueGroupOperations.readManyInRevue({
            params: { revueId: revue.id },
            session: Session.empty(),
        })
        expect(listed).toMatchObject({ id, memberCount: 2 })
    })

    test('reach a visitor as name and title alone', async () => {
        const revue = await createRevue(2026)
        const { groupId } = await createSubGroupWithGroupId(revue.id, 'Band')
        const [kari] = await createUsers('Kari')
        await addMembers(groupId, currentOrder, [kari])
        await revueSubGroupOperations.setMemberTitle({
            params: { groupId },
            data: { userId: kari.id, title: 'Kapellmester' },
            session: revueAdmin,
        })

        const group = await revueGroupOperations.readInRevue({
            params: { year: 2026, name: 'Band' },
            session: Session.empty(),
        })
        expect(group.members).toEqual([{ name: 'Kari Nordmann', title: 'Kapellmester' }])
    })
})

describe('the description of a revue group', () => {
    test('is the committee\'s admins\' to change for the revue group over their committee', async () => {
        const revue = await createRevue(2026)
        const committee = await createCommittee()
        const { id, articleSectionId } = await revueGroupOperations.create({
            params: { revueId: revue.id },
            data: { type: 'COMMITTEE', name: 'Styret', committeeId: committee.id },
            session: revueAdmin,
        })
        const [kari] = await createUsers('Kari')

        await revueGroupOperations.articleSection.update({
            implementationParams: { revueGroupId: id },
            params: { articleSectionId },
            data: { imageSize: 300 },
            session: sessionOfAdminOf(kari, committee.groupId),
        })
        expect(await prisma.articleSection.findUniqueOrThrow({ where: { id: articleSectionId } }))
            .toMatchObject({ imageSize: 300 })
    })

    test('is not another sub group\'s admin\'s to change', async () => {
        const revue = await createRevue(2026)
        const band = await createSubGroupWithGroupId(revue.id, 'Band')
        const acting = await createSubGroupWithGroupId(revue.id, 'Skuespill')
        const [kari] = await createUsers('Kari')

        await expect(revueGroupOperations.articleSection.update({
            implementationParams: { revueGroupId: band.id },
            params: { articleSectionId: band.articleSectionId },
            data: { imageSize: 300 },
            session: sessionOfAdminOf(kari, acting.groupId),
        })).rejects.toThrow(Smorekopp)
    })
})

describe('destroying a revue group', () => {
    test('of a sub group takes the sub group, its group, its memberships and its description', async () => {
        const revue = await createRevue(2026)
        const { id, groupId, revueSubGroupId } = await createSubGroupWithGroupId(revue.id, 'Band')
        const [kari] = await createUsers('Kari')
        await addMembers(groupId, currentOrder, [kari])
        const { articleSectionId } = await prisma.revueGroup.findUniqueOrThrow({ where: { id } })

        await revueGroupOperations.destroy({ params: { revueGroupId: id }, session: revueAdmin })

        expect(await prisma.revueSubGroup.findUnique({ where: { id: revueSubGroupId ?? 0 } })).toBeNull()
        expect(await prisma.group.findUnique({ where: { id: groupId } })).toBeNull()
        expect(await prisma.membership.count({ where: { groupId } })).toBe(0)
        expect(await prisma.articleSection.findUnique({ where: { id: articleSectionId } })).toBeNull()
        expect(await prisma.revueGroupInRevue.count()).toBe(0)
    })

    test('of a committee leaves the committee and its members alone', async () => {
        const revue = await createRevue(2026)
        const committee = await createCommittee()
        const [kari] = await createUsers('Kari')
        await committeeOperations.addMembers({
            params: { groupId: committee.groupId },
            data: { users: [{ userId: kari.id, admin: true }] },
            session: committeeAdmin,
        })
        const { id } = await revueGroupOperations.create({
            params: { revueId: revue.id },
            data: { type: 'COMMITTEE', name: 'Styret', committeeId: committee.id },
            session: revueAdmin,
        })

        await revueGroupOperations.destroy({ params: { revueGroupId: id }, session: revueAdmin })

        expect(await prisma.committee.findUnique({ where: { id: committee.id } })).not.toBeNull()
        expect(await prisma.membership.count({ where: { groupId: committee.groupId, active: true } })).toBe(1)
    })

    test('as a revue is destroyed, takes it out of the revue and keeps it', async () => {
        const first = await createRevue(2025)
        const second = await createRevue(2026)
        const { id } = await createSubGroupWithGroupId(second.id, 'Band')
        await revueGroupOperations.addToRevue({
            params: { revueId: first.id },
            data: { revueGroupId: id, order: currentOrder - 1 },
            session: revueAdmin,
        })

        await revueOperations.destroy({ params: { revueId: second.id }, session: revueAdmin })

        expect(await prisma.revueGroup.findUnique({ where: { id } })).not.toBeNull()
        expect(await prisma.revueGroupInRevue.findMany({ select: { revueId: true } })).toEqual([{ revueId: first.id }])
    })
})

describe('a revue sub group in the group system', () => {
    test('is named by its revue group, in the groups of every type and in a user\'s memberships', async () => {
        const revue = await createRevue(2026)
        const { id, groupId } = await createSubGroupWithGroupId(revue.id, 'Band')
        const [kari] = await createUsers('Kari')
        await addMembers(groupId, currentOrder, [kari])
        await revueGroupOperations.update({
            params: { revueGroupId: id },
            data: { name: 'Orkesteret' },
            session: revueAdmin,
        })

        const groups = await readExpandedOfAllTypes({ session: Session.empty() })
        expect(groups.REVUE_SUB_GROUP?.find(group => group.id === groupId)).toMatchObject({ name: 'Orkesteret', members: 1 })

        const memberships = await revueSubGroupOperations.readMembershipsOfUser({
            params: { userId: kari.id },
            bypassAuth: true,
        })
        expect(memberships.map(membership => membership.groupName)).toEqual(['Orkesteret'])
    })

    test('behind Omega\'s order holds the next increment back until it is migrated or pensioned', async () => {
        const revue = await createRevue(2026)
        const { groupId } = await createSubGroupWithGroupId(revue.id, 'Band')
        const requirementOf = async () => (await omegaOrderOperations.readRequirements({ bypassAuth: true }))
            .find(requirement => requirement.key === 'GROUPS_MIGRATED_REVUE_SUB_GROUP')

        expect(await requirementOf()).toMatchObject({
            description: `Alle revyundergrupper er i orden ${currentOrder}`,
            fulfilled: true,
        })
        await prisma.group.update({ where: { id: groupId }, data: { order: currentOrder - 1 } })
        expect(await requirementOf()).toMatchObject({ fulfilled: false, detail: '1 gjenstår' })

        await revueSubGroupOperations.migrateGroup({ params: { groupId }, data: { keep: [] }, session: revueAdmin })
        expect(await requirementOf()).toMatchObject({ fulfilled: true })

        await prisma.group.update({ where: { id: groupId }, data: { order: currentOrder - 1 } })
        await revueSubGroupOperations.pension({ params: { groupId }, data: { pensioned: true }, session: revueAdmin })
        expect(await requirementOf()).toMatchObject({ fulfilled: true })
    })

    test('pensioned is not renamed or destroyed until it is brought back', async () => {
        const revue = await createRevue(2026)
        const { id, groupId } = await createSubGroupWithGroupId(revue.id, 'Band')
        await revueSubGroupOperations.pension({ params: { groupId }, data: { pensioned: true }, session: revueAdmin })

        await expect(revueGroupOperations.update({
            params: { revueGroupId: id },
            data: { name: 'Orkesteret' },
            session: revueAdmin,
        })).rejects.toMatchObject({ errorCode: 'BAD PARAMETERS' })
        await expect(revueGroupOperations.destroy({ params: { revueGroupId: id }, session: revueAdmin }))
            .rejects.toMatchObject({ errorCode: 'BAD PARAMETERS' })
    })

    test('takes members who are not active students, picked by its own admin', async () => {
        const revue = await createRevue(2026)
        const { groupId } = await createSubGroupWithGroupId(revue.id, 'Band')
        const [admin, graduated] = await createUsers('Admin', 'Uteksaminert')
        await addMembers(groupId, currentOrder, [admin], true)
        const sessionOfAdmin = sessionOfAdminOf(admin, groupId)
        const page = (partOfName: string) => ({
            groupId,
            paging: { page: { page: 0 as const, pageSize: 50, cursor: null }, details: { partOfName, groups: [] } },
        })

        const addable = await revueSubGroupOperations.readAddableUsers({
            params: page('Uteksaminert'),
            session: sessionOfAdmin,
        })
        expect(addable.map(user => user.id)).toEqual([graduated.id])
        await revueSubGroupOperations.addMembers({
            params: { groupId },
            data: { users: [{ userId: graduated.id, admin: false }] },
            session: sessionOfAdmin,
        })
        await expect(revueSubGroupOperations.readAddableUsers({ params: page(''), session: Session.empty() }))
            .rejects.toThrow(Smorekopp)
    })
})

function createRevue(year: number) {
    return revueOperations.create({ data: { year, name: `Revyen ${year}`, ...defaultRevuePalette }, session: revueAdmin })
}

function createSubGroup(revueId: number, name: string) {
    return revueGroupOperations.create({ params: { revueId }, data: { type: 'REVUE_SUB_GROUP', name }, session: revueAdmin })
}

/** A sub group in the revue, at the order given or Omega's own, with the id of its group. */
async function createSubGroupWithGroupId(revueId: number, name: string, order = currentOrder) {
    const revueGroup = await createSubGroup(revueId, name)
    await prisma.revueGroupInRevue.update({
        where: { revueId_revueGroupId: { revueId, revueGroupId: revueGroup.id } },
        data: { order },
    })
    const { groupId } = await prisma.revueSubGroup.findUniqueOrThrow({ where: { id: revueGroup.revueSubGroupId ?? 0 } })
    return { ...revueGroup, groupId }
}

async function createCommittee() {
    return committeeOperations.create({
        data: { name: 'Revystyret', shortName: 'revue-test-board' },
        session: committeeAdmin,
    })
}

function createUsers(...firstnames: string[]) {
    return Promise.all(firstnames.map(firstname => prisma.user.create({
        select: userPrivateSelection,
        data: {
            username: `revue-test-${firstname.toLowerCase()}`,
            email: `revue-test-${firstname.toLowerCase()}@example.com`,
            firstname,
            lastname: 'Nordmann',
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
    })))
}

function addMembers(groupId: number, order: number, users: { id: number }[], admin = false) {
    return revueSubGroupOperations.addMembers({
        params: { groupId, order },
        data: { users: users.map(user => ({ userId: user.id, admin })) },
        session: revueAdmin,
    })
}

/** The session of the user as an active admin of the group, as the session holds its memberships. */
function sessionOfAdminOf(user: Awaited<ReturnType<typeof createUsers>>[number], groupId: number) {
    return Session.fromJsObject({
        user,
        permissions: [],
        memberships: [{ groupId, admin: true, active: true, order: currentOrder }],
    })
}

async function memberNames(year: number, name: string) {
    const group = await revueGroupOperations.readInRevue({ params: { year, name }, session: Session.empty() })
    return group.members.map(member => member.name)
}
