import { Session } from '@/auth/session/Session'
import { checkVisibility } from '@/auth/visibility/checkVisibility'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { revueOperations } from '@/services/revue/operations'
import { revueGroupOperations } from '@/services/revue/groups/operations'
import { revueSubGroupOperations } from '@/services/groups/revueSubGroups/operations'
import { committeeOperations } from '@/services/groups/committees/operations'
import { groupOperations } from '@/services/groups/operations'
import { readExpandedOfAllTypes } from '@/services/groups/readExpandedOfAllTypes'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { userPrivateSelection } from '@/services/users/constants'
import { defaultRevuePalette } from '@/app/(revue)/_lib/revueTheme'
import { activeMembersOf } from 'tests/utils'
import { afterEach, beforeAll, describe, expect, test } from '@jest/globals'
import type { AnySession } from '@/auth/session/Session'

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

    test('of a sub group without a revue puts its group at Omega\'s order and it in no revue', async () => {
        const revueGroup = await revueGroupOperations.create({
            params: {},
            data: { type: 'REVUE_SUB_GROUP', name: 'Band' },
            session: revueAdmin,
        })

        const made = await prisma.revueGroup.findUniqueOrThrow({
            where: { id: revueGroup.id },
            include: { revueSubGroup: { include: { group: true } }, revues: true },
        })
        expect(made.revueSubGroup?.group).toMatchObject({ order: currentOrder, pensioned: false })
        expect(made.revues).toEqual([])
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

describe('making a revue with groups', () => {
    test('puts each group in at the order chosen for it, of either kind', async () => {
        const styret = await createCommitteeKindInNoRevue()
        const band = await createSubGroupInNoRevue('Band')

        const revue = await createRevueWithGroups(2027, [
            { revueGroupId: styret.id, order: currentOrder - 1 },
            { revueGroupId: band.id, order: currentOrder },
        ])

        expect(await prisma.revueGroupInRevue.findMany({
            where: { revueId: revue.id },
            select: { revueGroupId: true, order: true },
            orderBy: { order: 'asc' },
        })).toEqual([
            { revueGroupId: styret.id, order: currentOrder - 1 },
            { revueGroupId: band.id, order: currentOrder },
        ])
    })

    test('puts no group in when none is given', async () => {
        await createSubGroupInNoRevue('Band')

        await createRevue(2026)
        await createRevueWithGroups(2027, [])

        expect(await prisma.revueGroupInRevue.count()).toBe(0)
    })

    test('is refused, leaving no revue, for an order Omega lacks, a group twice or one that does not exist', async () => {
        const band = await createSubGroupInNoRevue('Band')

        await expect(createRevueWithGroups(2027, [{ revueGroupId: band.id, order: currentOrder + 1 }]))
            .rejects.toMatchObject({ errors: [{ message: `Omega har ingen orden ${currentOrder + 1}` }] })
        await expect(createRevueWithGroups(2027, [
            { revueGroupId: band.id, order: currentOrder },
            { revueGroupId: band.id, order: currentOrder - 1 },
        ])).rejects.toMatchObject({ errorCode: 'DUPLICATE' })
        await expect(createRevueWithGroups(2027, [
            { revueGroupId: band.id, order: currentOrder },
            { revueGroupId: band.id + 1000, order: currentOrder },
        ])).rejects.toMatchObject({ errorCode: 'BAD PARAMETERS' })
        expect(await prisma.revue.count()).toBe(0)
        expect(await prisma.revueGroupInRevue.count()).toBe(0)
    })

    test('changes no group\'s order, memberships or pension', async () => {
        const committee = await createCommittee()
        const [kari, ola] = await createUsers('Kari', 'Ola')
        await committeeOperations.addMembers({
            params: { groupId: committee.groupId },
            data: { users: [{ userId: kari.id, admin: true }] },
            session: committeeAdmin,
        })
        const styret = await revueGroupOperations.create({
            params: {},
            data: { type: 'COMMITTEE', name: 'Styret', committeeId: committee.id },
            session: revueAdmin,
        })
        const band = await createSubGroupInNoRevue('Band')
        await addMembers(band.groupId, currentOrder, [ola], true)
        const groupIds = [committee.groupId, band.groupId]
        const groupsAndMemberships = async () => ({
            groups: await prisma.group.findMany({
                where: { id: { in: groupIds } },
                select: { id: true, order: true, pensioned: true },
                orderBy: { id: 'asc' },
            }),
            memberships: await prisma.membership.findMany({
                where: { groupId: { in: groupIds } },
                select: { groupId: true, userId: true, order: true, active: true, admin: true },
                orderBy: [{ groupId: 'asc' }, { userId: 'asc' }],
            }),
        })
        const before = await groupsAndMemberships()

        await createRevueWithGroups(2027, [
            { revueGroupId: styret.id, order: currentOrder - 1 },
            { revueGroupId: band.id, order: currentOrder - 1 },
        ])

        expect(await groupsAndMemberships()).toEqual(before)
    })

    test('is made while Omega has not incremented since the previous revue', async () => {
        const previous = await createRevue(2026)
        const band = await createSubGroupWithGroupId(previous.id, 'Band')

        const revue = await createRevueWithGroups(2027, [{ revueGroupId: band.id, order: currentOrder }])

        expect(await prisma.revueGroupInRevue.findMany({ where: { revueId: revue.id }, select: { order: true } }))
            .toEqual([{ order: currentOrder }])
    })

    test('chooses from every revue group, with its own order and its order in the previous revue', async () => {
        await createRevue(2025)
        const previous = await createRevue(2026)
        const band = await createSubGroupWithGroupId(previous.id, 'Band', currentOrder - 1)
        const teknikk = await createSubGroupInNoRevue('Teknikk')
        await revueSubGroupOperations.pension({
            params: { groupId: teknikk.groupId },
            data: { pensioned: true },
            session: revueAdmin,
        })

        expect(await revueGroupOperations.readManyForNewRevue({ session: revueAdmin })).toEqual({
            previousRevue: { year: 2026, name: 'Revyen 2026' },
            groups: [
                {
                    id: band.id,
                    name: 'Band',
                    type: 'REVUE_SUB_GROUP',
                    order: currentOrder,
                    pensioned: false,
                    orderInPreviousRevue: currentOrder - 1,
                },
                {
                    id: teknikk.id,
                    name: 'Teknikk',
                    type: 'REVUE_SUB_GROUP',
                    order: currentOrder,
                    pensioned: true,
                    orderInPreviousRevue: null,
                },
            ],
        })
        await expect(revueGroupOperations.readManyForNewRevue({ session: Session.empty() })).rejects.toThrow(Smorekopp)
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

describe('the members a revue group would have in a revue at an order', () => {
    test('are those a revue at that order would list, whether or not the group is in a revue', async () => {
        const band = await revueGroupOperations.create({
            params: {},
            data: { type: 'REVUE_SUB_GROUP', name: 'Band' },
            session: revueAdmin,
        })
        const { groupId } = await prisma.revueSubGroup.findUniqueOrThrow({ where: { id: band.revueSubGroupId ?? 0 } })
        const [kari, ola, per] = await createUsers('Kari', 'Ola', 'Per')
        await addMembers(groupId, currentOrder, [kari, ola])
        await revueSubGroupOperations.removeMembers({
            params: { groupId },
            data: { userIds: [ola.id] },
            session: revueAdmin,
        })
        await addMembers(groupId, currentOrder - 1, [per])
        const membersAt = (order: number) => revueGroupOperations.readMembersAtOrder({
            params: { revueGroupId: band.id, order },
            session: revueAdmin,
        })

        expect(await membersAt(currentOrder)).toEqual([{ name: 'Kari Nordmann', title: 'Medlem' }])
        expect(await membersAt(currentOrder - 1)).toEqual([{ name: 'Per Nordmann', title: 'Medlem' }])
        expect(await membersAt(currentOrder + 1)).toEqual([])
    })

    test('are read by a revue admin, and not by a visitor, a plain user or the sub group\'s admin', async () => {
        const revue = await createRevue(2026)
        const { id, groupId } = await createSubGroupWithGroupId(revue.id, 'Band')
        const [admin] = await createUsers('Admin')
        await addMembers(groupId, currentOrder, [admin], true)
        const params = { revueGroupId: id, order: currentOrder }

        await expect(revueGroupOperations.readMembersAtOrder({ params, session: revueAdmin })).resolves.toHaveLength(1)
        for (const session of [
            Session.empty(),
            Session.fromJsObject({ user: admin, permissions: ['USERS_USE'], memberships: [] }),
            sessionOfAdminOf(admin, groupId),
        ]) {
            await expect(revueGroupOperations.readMembersAtOrder({ params, session })).rejects.toThrow(Smorekopp)
        }
    })
})

describe('a revue\'s members of a sub group, removed and deleted', () => {
    test('one removed is not listed while the group stands in the order, is again once it has moved past it, '
        + 'and is gone everywhere once deleted', async () => {
        const revue = await createRevue(2025)
        const band = await createSubGroupWithGroupId(revue.id, 'Band', currentOrder - 1)
        await prisma.group.update({ where: { id: band.groupId }, data: { order: currentOrder - 1 } })
        const [kari, ola] = await createUsers('Kari', 'Ola')
        await addMembers(band.groupId, currentOrder - 1, [kari], true)
        await addMembers(band.groupId, currentOrder - 1, [ola])
        const listed = async () => ({
            groupPage: await memberNames(2025, 'Band'),
            count: (await revueGroupOperations.readManyInRevue({
                params: { revueId: revue.id },
                session: Session.empty(),
            }))[0].memberCount,
            profile: (await revueGroupOperations.readManyOfUser({ params: { userId: ola.id }, session: revueAdmin }))
                .map(group => group.revue.year),
            memberProfiles: (await revueGroupOperations.readMemberProfilesInRevue({
                params: { year: 2025, name: 'Band' },
                session: revueAdmin,
            })).map(member => member.username),
            preview: (await revueGroupOperations.readMembersAtOrder({
                params: { revueGroupId: band.id, order: currentOrder - 1 },
                session: revueAdmin,
            })).map(member => member.name),
        })

        await revueSubGroupOperations.removeMembers({
            params: { groupId: band.groupId },
            data: { userIds: [ola.id] },
            session: revueAdmin,
        })
        expect(await listed()).toEqual({
            groupPage: ['Kari Nordmann'],
            count: 1,
            profile: [],
            memberProfiles: [kari.username],
            preview: ['Kari Nordmann'],
        })

        await revueSubGroupOperations.migrateGroup({
            params: { groupId: band.groupId },
            data: { keep: [{ userId: kari.id, admin: true }] },
            session: revueAdmin,
        })
        expect(await listed()).toEqual({
            groupPage: ['Kari Nordmann', 'Ola Nordmann'],
            count: 2,
            profile: [2025],
            memberProfiles: [kari.username, ola.username],
            preview: ['Kari Nordmann', 'Ola Nordmann'],
        })

        await revueSubGroupOperations.destroyMembership({
            params: { groupId: band.groupId, order: currentOrder - 1 },
            data: { userId: ola.id },
            session: revueAdmin,
        })
        expect(await listed()).toEqual({
            groupPage: ['Kari Nordmann'],
            count: 1,
            profile: [],
            memberProfiles: [kari.username],
            preview: ['Kari Nordmann'],
        })
    })

    test('one added to a past order by mistake is deleted by the group\'s admin and gone from that revue', async () => {
        const revue = await createRevue(2025)
        const band = await createSubGroupWithGroupId(revue.id, 'Band', currentOrder - 1)
        const [kari, wrong] = await createUsers('Kari', 'Feil')
        await addMembers(band.groupId, currentOrder, [kari], true)
        await addMembers(band.groupId, currentOrder - 1, [kari, wrong])
        expect(await memberNames(2025, 'Band')).toEqual(['Kari Nordmann', 'Feil Nordmann'])

        await revueSubGroupOperations.destroyMembership({
            params: { groupId: band.groupId, order: currentOrder - 1 },
            data: { userId: wrong.id },
            session: sessionOfAdminOf(kari, band.groupId),
        })

        expect(await memberNames(2025, 'Band')).toEqual(['Kari Nordmann'])
    })

    test('deleting is refused to a visitor, a plain user, another sub group\'s admin and a committee\'s admin', async () => {
        const revue = await createRevue(2026)
        const band = await createSubGroupWithGroupId(revue.id, 'Band')
        const teknikk = await createSubGroupWithGroupId(revue.id, 'Teknikk')
        const committee = await createCommittee()
        const [kari, other] = await createUsers('Kari', 'Annen')
        await addMembers(band.groupId, currentOrder, [kari])
        await addMembers(teknikk.groupId, currentOrder, [other], true)

        for (const session of [
            Session.empty(),
            Session.fromJsObject({ user: other, permissions: ['USERS_USE'], memberships: [] }),
            sessionOfAdminOf(other, teknikk.groupId),
            Session.fromJsObject({
                user: other,
                permissions: ['COMMITTEE_ADMIN'],
                memberships: [{ groupId: committee.groupId, admin: true, active: true, order: currentOrder }],
            }),
        ]) {
            await expect(revueSubGroupOperations.destroyMembership({
                params: { groupId: band.groupId },
                data: { userId: kari.id },
                session,
            })).rejects.toThrow(Smorekopp)
        }
        expect(await prisma.membership.count({ where: { groupId: band.groupId } })).toBe(1)
    })

    test('deleting through a sub group\'s operation reaches no group of another type', async () => {
        const committee = await createCommittee()
        const [kari] = await createUsers('Kari')
        await committeeOperations.addMembers({
            params: { groupId: committee.groupId },
            data: { users: [{ userId: kari.id, admin: true }] },
            session: committeeAdmin,
        })
        await expect(revueSubGroupOperations.destroyMembership({
            params: { groupId: committee.groupId },
            data: { userId: kari.id },
            session: revueAdmin,
        })).rejects.toThrow(Smorekopp)
        expect(await prisma.membership.count({ where: { groupId: committee.groupId } })).toBe(1)
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

    test('is in a user\'s membership read, which a visibility is checked against by ACTIVE and by ORDER', async () => {
        const revue = await createRevue(2026)
        const { groupId } = await createSubGroupWithGroupId(revue.id, 'Band')
        const [member, removed, outsider] = await createUsers('Medlem', 'Fjernet', 'Utenfor')
        await addMembers(groupId, currentOrder, [member, removed])
        await revueSubGroupOperations.removeMembers({
            params: { groupId },
            data: { userIds: [removed.id] },
            session: revueAdmin,
        })
        const active = { requirements: [{ conditions: [activeMembersOf(groupId)] }] }
        const ofOrder = {
            requirements: [{ conditions: [{ groupId, order: currentOrder, onlyActive: false, onlyAdmins: false }] }],
        }

        const letIn = async (user: { id: number }) => {
            const memberships = await groupOperations.readMembershipsOfUserOfAllTypes.internalCall({
                params: { userId: user.id },
            })
            return [checkVisibility(memberships, active), checkVisibility(memberships, ofOrder)]
        }
        expect(await letIn(member)).toEqual([true, true])
        expect(await letIn(removed)).toEqual([false, true])
        expect(await letIn(outsider)).toEqual([false, false])
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

describe('the revue groups of a user', () => {
    test('are each group of each revue they were in, with the order, newest revue first', async () => {
        const [lastYear, thisYear] = [await createRevue(2025), await createRevue(2026)]
        const band = await createSubGroupWithGroupId(thisYear.id, 'Band')
        await revueGroupOperations.addToRevue({
            params: { revueId: lastYear.id },
            data: { revueGroupId: band.id, order: currentOrder - 1 },
            session: revueAdmin,
        })
        const committee = await createCommittee()
        await revueGroupOperations.create({
            params: { revueId: thisYear.id },
            data: { type: 'COMMITTEE', name: 'Styret', committeeId: committee.id },
            session: revueAdmin,
        })
        const [kari, ola] = await createUsers('Kari', 'Ola')
        await addMembers(band.groupId, currentOrder - 1, [kari])
        await addMembers(band.groupId, currentOrder, [kari, ola])
        await committeeOperations.addMembers({
            params: { groupId: committee.groupId },
            data: { users: [{ userId: kari.id, admin: true }] },
            session: committeeAdmin,
        })
        await revueSubGroupOperations.removeMembers({
            params: { groupId: band.groupId },
            data: { userIds: [ola.id] },
            session: revueAdmin,
        })

        const groupsOf = (user: { id: number }) => revueGroupOperations.readManyOfUser({
            params: { userId: user.id },
            session: revueAdmin,
        })
        const row = (year: number, name: string, type: string, order: number) => ({
            revue: { year, name: `Revyen ${year}` }, name, type, order, title: 'Medlem',
        })
        expect(await groupsOf(kari)).toEqual([
            row(2026, 'Band', 'REVUE_SUB_GROUP', currentOrder),
            row(2026, 'Styret', 'COMMITTEE', currentOrder),
            row(2025, 'Band', 'REVUE_SUB_GROUP', currentOrder - 1),
        ])
        expect(await groupsOf(ola)).toEqual([])
    })

    test('are read by the user themself or with USERS_USE alone', async () => {
        const [kari, ola] = await createUsers('Kari', 'Ola')
        const read = (session: AnySession) => revueGroupOperations.readManyOfUser({ params: { userId: kari.id }, session })
        const sessionOf = (user: typeof kari) => Session.fromJsObject({ user, permissions: [], memberships: [] })
        const userAdmin = Session.fromJsObject({ user: null, permissions: ['USERS_USE'], memberships: [] })

        await expect(read(sessionOf(kari))).resolves.toEqual([])
        await expect(read(userAdmin)).resolves.toEqual([])
        await expect(read(sessionOf(ola))).rejects.toThrow(Smorekopp)
        await expect(read(Session.empty())).rejects.toThrow(Smorekopp)
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

function createRevueWithGroups(year: number, groups: { revueGroupId: number, order: number }[]) {
    return revueOperations.create({
        data: { year, name: `Revyen ${year}`, ...defaultRevuePalette, groups },
        session: revueAdmin,
    })
}

async function createSubGroupInNoRevue(name: string) {
    const revueGroup = await revueGroupOperations.create({
        params: {},
        data: { type: 'REVUE_SUB_GROUP', name },
        session: revueAdmin,
    })
    const { groupId } = await prisma.revueSubGroup.findUniqueOrThrow({ where: { id: revueGroup.revueSubGroupId ?? 0 } })
    return { ...revueGroup, groupId }
}

async function createCommitteeKindInNoRevue() {
    const committee = await createCommittee()
    return revueGroupOperations.create({
        params: {},
        data: { type: 'COMMITTEE', name: 'Styret', committeeId: committee.id },
        session: revueAdmin,
    })
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
