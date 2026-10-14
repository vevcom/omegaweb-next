import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { lockerOperations } from '@/services/lockers/operations'
import { lockerLocationOperations } from '@/services/lockers/locations/operations'
import { lockerReservationOperations } from '@/services/lockers/reservations/operations'
import { userOperations } from '@/services/users/operations'
import { beforeAll, describe, expect, test } from '@jest/globals'
import type { MembershipFiltered } from '@/services/groups/types'
import type { UserFiltered } from '@/services/users/types'

const DAY = 24 * 60 * 60 * 1000
const BUILDING = 'Testblokka'
const FLOOR = 1

/** Locker numbers well above the ones the dev seeding creates. */
let nextLockerId = 900000
let currentOrder: number
let groupId: number

async function createTestUser(username: string) {
    return userOperations.create({
        data: {
            email: `${username}@omega.ntnu.no`,
            firstname: 'Test',
            lastname: 'Testesen',
            username,
            emailVerified: new Date().toISOString(),
        },
        bypassAuth: true,
    })
}

function sessionOf(user: UserFiltered | null, memberships: Omit<MembershipFiltered, 'order'>[] = []) {
    return Session.fromJsObject({
        user,
        permissions: ['LOCKER_USE'],
        memberships: memberships.map(membership => ({ ...membership, order: currentOrder })),
    })
}

async function createLocker() {
    const locker = await lockerOperations.create({
        data: { building: BUILDING, floor: FLOOR, id: ++nextLockerId },
        bypassAuth: true,
    })
    return locker.id
}

const reserve = (
    user: UserFiltered,
    lockerId: number,
    { endDate, groupId: reservingGroupId = null, session = sessionOf(user) }: {
        endDate?: Date,
        groupId?: number | null,
        session?: Session<'HAS_USER' | 'NO_USER'>,
    } = {},
) => lockerReservationOperations.create({
    params: { lockerId, userId: user.id },
    data: { groupId: reservingGroupId ?? 'null', endDate: endDate ?? '' },
    session,
})

const countActiveReservations = (lockerId: number) => prisma.lockerReservation.count({
    where: { lockerId, active: true },
})

beforeAll(async () => {
    currentOrder = (await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })).order
    const group = await prisma.group.create({
        data: {
            groupType: 'MANUAL_GROUP',
            order: currentOrder,
            manualGroup: { create: { name: 'locker-group', shortName: 'locker-group' } },
        },
    })
    groupId = group.id
    await lockerLocationOperations.create({ data: { building: BUILDING, floor: FLOOR }, bypassAuth: true })
})

describe('reserving a locker', () => {
    test('a locker whose reservation has expired can be reserved again', async () => {
        const lockerId = await createLocker()
        const formerHolder = await createTestUser('lockerformerholder')
        const user = await createTestUser('lockernextholder')

        await reserve(formerHolder, lockerId, { endDate: new Date(Date.now() - DAY) })
        const reservation = await reserve(user, lockerId, { endDate: new Date(Date.now() + DAY) })

        expect(reservation.userId).toBe(user.id)
        expect(await countActiveReservations(lockerId)).toBe(1)
        expect(await prisma.lockerReservation.count({ where: { lockerId } })).toBe(2)
    })

    test('reading a locker deactivates its expired reservation', async () => {
        const lockerId = await createLocker()
        const user = await createTestUser('lockerexpiredread')

        await reserve(user, lockerId, { endDate: new Date(Date.now() - DAY) })
        const locker = await lockerOperations.read({ params: { id: lockerId }, session: sessionOf(user) })

        expect(locker.LockerReservation).toHaveLength(0)
        expect(await countActiveReservations(lockerId)).toBe(0)
    })

    test('a locker with an active reservation is refused', async () => {
        const lockerId = await createLocker()
        const holder = await createTestUser('lockerholder')
        const user = await createTestUser('lockerlatecomer')

        await reserve(holder, lockerId)

        await expect(reserve(user, lockerId)).rejects.toThrow(new Smorekopp('DUPLICATE'))
        expect(await countActiveReservations(lockerId)).toBe(1)
    })

    test('the database holds one active reservation per locker', async () => {
        const lockerId = await createLocker()
        const holder = await createTestUser('lockerdbholder')
        const user = await createTestUser('lockerdblatecomer')

        await reserve(holder, lockerId)

        await expect(prisma.lockerReservation.create({ data: { lockerId, userId: user.id } })).rejects.toThrow()
        await prisma.lockerReservation.create({ data: { lockerId, userId: user.id, active: false } })
        expect(await countActiveReservations(lockerId)).toBe(1)
    })

    test('users reserve for themselves only', async () => {
        const lockerId = await createLocker()
        const user = await createTestUser('lockerforother')
        const other = await createTestUser('lockerother')

        await expect(reserve(other, lockerId, { session: sessionOf(user) })).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
        expect(await countActiveReservations(lockerId)).toBe(0)
    })

    test('reserving on behalf of a group takes an active membership of it', async () => {
        const lockerId = await createLocker()
        const member = await createTestUser('lockergroupmember')
        const formerMember = await createTestUser('lockerformermember')

        await expect(reserve(formerMember, lockerId, {
            groupId,
            session: sessionOf(formerMember, [{ groupId, active: false, admin: false }]),
        })).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))

        const reservation = await reserve(member, lockerId, {
            groupId,
            session: sessionOf(member, [{ groupId, active: true, admin: false }]),
        })
        expect(reservation.groupId).toBe(groupId)
    })
})

describe('a session without a user', () => {
    test('cannot reserve a locker', async () => {
        const lockerId = await createLocker()
        const user = await createTestUser('lockernouserreserve')

        await expect(reserve(user, lockerId, { session: sessionOf(null) }))
            .rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))
        expect(await countActiveReservations(lockerId)).toBe(0)
    })

    test('cannot update a reservation', async () => {
        const lockerId = await createLocker()
        const user = await createTestUser('lockernouserupdate')
        const reservation = await reserve(user, lockerId)

        await expect(lockerReservationOperations.update({
            params: { id: reservation.id },
            data: { groupId: 'null', endDate: new Date(Date.now() + DAY) },
            session: sessionOf(null),
        })).rejects.toThrow(new Smorekopp('UNAUTHENTICATED'))
        expect((await prisma.lockerReservation.findUniqueOrThrow({ where: { id: reservation.id } })).endDate).toBeNull()
    })
})

describe('updating a reservation', () => {
    test('only the user holding it updates it', async () => {
        const lockerId = await createLocker()
        const holder = await createTestUser('lockerupdateholder')
        const other = await createTestUser('lockerupdateother')
        const reservation = await reserve(holder, lockerId)
        const endDate = new Date(Date.now() + DAY)
        const update = (session: Session<'HAS_USER' | 'NO_USER'>) => lockerReservationOperations.update({
            params: { id: reservation.id },
            data: { groupId: 'null', endDate },
            session,
        })

        await expect(update(sessionOf(other))).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
        const updated = await update(sessionOf(holder))
        expect(updated.endDate?.getTime()).toBe(endDate.getTime())
    })
})
