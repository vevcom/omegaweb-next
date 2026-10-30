import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { eventQuotaOperations } from '@/services/events/quotas/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { userOperations } from '@/services/users/operations'
import { beforeAll, describe, expect, test } from '@jest/globals'
import type { MembershipFiltered } from '@/services/groups/types'
import type { VisibilityMatrix } from '@/services/visibility/types'
import type { EventCanView } from '@/prisma-generated-pn-types'

/**
 * Events with several quotas: how they fill, how the waiting list feeds them, and how they are
 * administrated. Single-quota events, which behave as events always did, are covered by
 * eventRegistration.test.ts.
 */

const HOUR = 60 * 60 * 1000

let currentOrder: number
/** Two groups a quota may be reserved for, and one whose members organise every test event. */
let groupOne: number
let groupTwo: number
let organisers: number
let userCounter = 0

async function createManualGroup(shortName: string) {
    const group = await prisma.group.create({
        data: {
            groupType: 'MANUAL_GROUP',
            order: currentOrder,
            manualGroup: { create: { name: shortName, shortName } },
        },
    })
    return group.id
}

/** A user with real memberships in the groups, which promotion from the waiting list reads. */
async function createUser(groupIds: number[]) {
    userCounter++
    const user = await userOperations.create({
        data: {
            email: `quota-user-${userCounter}@omega.ntnu.no`,
            firstname: 'Kvote',
            lastname: 'Testesen',
            username: `quotauser${userCounter}`,
            emailVerified: new Date().toISOString(),
        },
        bypassAuth: true,
    })
    await prisma.membership.createMany({
        data: groupIds.map(groupId => ({ userId: user.id, groupId, admin: false, active: true, order: currentOrder })),
    })
    return { user, groupIds }
}

type TestUser = Awaited<ReturnType<typeof createUser>>

function sessionOf({ user, groupIds }: TestUser) {
    const memberships: MembershipFiltered[] = groupIds.map(groupId => ({
        groupId, order: currentOrder, active: true, admin: false,
    }))
    return Session.fromJsObject({ user, permissions: [], memberships })
}

const activeIn = (groupId: number): VisibilityMatrix => ({ requirements: [{ conditions: [{ type: 'ACTIVE', groupId }] }] })
const everyone: VisibilityMatrix = { requirements: [] }

type QuotaSpec = {
    name: string,
    places: number,
    visibility?: VisibilityMatrix,
    registrationStart?: Date,
    registrationEnd?: Date,
}

/**
 * A published event organised by `organisers`, with the quotas in the order given. The waiting list
 * is switched on once the quotas are there, since an event without registration may not have one.
 */
async function createEvent(
    quotas: QuotaSpec[],
    { waitingList = true, canBeViewedBy = 'ALL' }: { waitingList?: boolean, canBeViewedBy?: EventCanView } = {},
) {
    const event = await eventOperations.create({
        data: {
            name: 'Kvotearrangement',
            location: 'Lophtet',
            eventStart: new Date(Date.now() + 7 * 24 * HOUR),
            eventEnd: new Date(Date.now() + 7 * 24 * HOUR + 2 * HOUR),
            canBeViewedBy,
            takesRegistration: false,
            waitingList: false,
            tagIds: [],
            visibilityAdminRequirements: activeIn(organisers).requirements,
        },
        bypassAuth: true,
    })
    const created = []
    for (const quota of quotas) {
        created.push(await eventQuotaOperations.create({
            params: { eventId: event.id },
            data: {
                name: quota.name,
                places: quota.places,
                registrationStart: quota.registrationStart ?? new Date(Date.now() - HOUR),
                registrationEnd: quota.registrationEnd ?? new Date(Date.now() + 24 * HOUR),
                visibilityRequirements: (quota.visibility ?? everyone).requirements,
            },
            bypassAuth: true,
        }))
    }
    await eventOperations.update({ params: { id: event.id }, data: { waitingList }, bypassAuth: true })
    await eventOperations.setPublished({ params: { id: event.id }, data: { published: true }, bypassAuth: true })
    return { eventId: event.id, quotas: created }
}

const register = (testUser: TestUser, eventId: number) => eventRegistrationOperations.create({
    params: { userId: testUser.user.id, eventId },
    session: sessionOf(testUser),
})

const readOfUser = (testUser: TestUser, eventId: number) => eventRegistrationOperations.readOfUser({
    params: { eventId, userId: testUser.user.id },
    bypassAuth: true,
})

beforeAll(async () => {
    currentOrder = (await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })).order
    groupOne = await createManualGroup('quota-group-one')
    groupTwo = await createManualGroup('quota-group-two')
    organisers = await createManualGroup('quota-organisers')
})

describe('filling several quotas', () => {
    test('a registrant takes the first quota in order they pass that has a place', async () => {
        const { eventId, quotas: [reserved, open] } = await createEvent([
            { name: 'Gruppe én', places: 1, visibility: activeIn(groupOne) },
            { name: 'Alle', places: 1 },
        ])
        const firstMember = await createUser([groupOne])
        const secondMember = await createUser([groupOne])
        const outsider = await createUser([groupTwo])

        expect(await register(firstMember, eventId)).toMatchObject({ state: 'IN_QUOTA', quotaId: reserved.id })
        // The reserved quota is full, so the next member falls through to the open one.
        expect(await register(secondMember, eventId)).toMatchObject({ state: 'IN_QUOTA', quotaId: open.id })
        expect(await register(outsider, eventId)).toMatchObject({ state: 'WAITING_LIST', waitingListEventId: eventId })
    })

    test('a quota the registrant does not pass is skipped even with places left', async () => {
        const { eventId, quotas: [, open] } = await createEvent([
            { name: 'Gruppe én', places: 5, visibility: activeIn(groupOne) },
            { name: 'Alle', places: 5 },
        ])
        const outsider = await createUser([groupTwo])

        expect(await register(outsider, eventId)).toMatchObject({ state: 'IN_QUOTA', quotaId: open.id })
    })

    test('a quota that has not opened yet is skipped for one that has', async () => {
        const { eventId, quotas: [, open] } = await createEvent([
            { name: 'Senere', places: 5, registrationStart: new Date(Date.now() + HOUR) },
            { name: 'Nå', places: 5 },
        ])
        const member = await createUser([groupOne])

        expect(await register(member, eventId)).toMatchObject({ state: 'IN_QUOTA', quotaId: open.id })
    })

    test('passing no quota at all refuses registration', async () => {
        const { eventId } = await createEvent([{ name: 'Gruppe én', places: 5, visibility: activeIn(groupOne) }])
        const outsider = await createUser([groupTwo])

        await expect(register(outsider, eventId)).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
    })

    test('with every quota the registrant passes closed, registration is closed', async () => {
        const { eventId } = await createEvent([
            {
                name: 'Stengt',
                places: 5,
                registrationStart: new Date(Date.now() - 2 * HOUR),
                registrationEnd: new Date(Date.now() - HOUR),
            },
            { name: 'Gruppe to', places: 5, visibility: activeIn(groupTwo) },
        ])
        const member = await createUser([groupOne])

        await expect(register(member, eventId)).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        expect(await readOfUser(member, eventId)).toBeNull()
    })

    test('an administrator puts someone into the quota they name, places permitting', async () => {
        const { eventId, quotas: [reserved, open] } = await createEvent([
            { name: 'Gruppe én', places: 1, visibility: activeIn(groupOne) },
            { name: 'Alle', places: 5 },
        ])
        const organiser = await createUser([organisers])
        const outsider = await createUser([groupTwo])
        const another = await createUser([groupTwo])

        // Not held to the quota's visibility.
        await eventRegistrationOperations.createAsAdmin({
            params: { userId: outsider.user.id, eventId, quotaId: reserved.id },
            session: sessionOf(organiser),
        })
        expect(await readOfUser(outsider, eventId)).toMatchObject({ quotaId: reserved.id })

        await expect(eventRegistrationOperations.createAsAdmin({
            params: { userId: another.user.id, eventId, quotaId: reserved.id },
            session: sessionOf(organiser),
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))

        // Without naming one, the first with a place.
        await eventRegistrationOperations.createAsAdmin({
            params: { userId: another.user.id, eventId },
            session: sessionOf(organiser),
        })
        expect(await readOfUser(another, eventId)).toMatchObject({ quotaId: open.id })
    })
})

describe('moving registrations between quotas', () => {
    test('a registration moved out of a quota frees a place for the first waiting who passes it', async () => {
        const { eventId, quotas: [reserved, open] } = await createEvent([
            { name: 'Gruppe én', places: 1, visibility: activeIn(groupOne) },
            { name: 'Alle', places: 1 },
        ])
        const organiser = await createUser([organisers])
        const seated = await createUser([groupOne])
        const outsiderWaiting = await createUser([groupTwo])
        const memberWaiting = await createUser([groupOne])
        const filler = await createUser([groupTwo])

        await register(seated, eventId)
        await register(filler, eventId)
        await register(outsiderWaiting, eventId)
        await register(memberWaiting, eventId)

        // Opening a third place in the open quota, then moving the seated member there.
        await eventQuotaOperations.update({ params: { id: open.id }, data: { places: 1 }, bypassAuth: true })
        await prisma.eventRegistration.delete({ where: { id: (await readOfUser(filler, eventId))!.id } })
        await eventRegistrationOperations.moveToQuota({
            params: { registrationId: (await readOfUser(seated, eventId))!.id },
            data: { quotaId: open.id },
            session: sessionOf(organiser),
        })

        expect(await readOfUser(seated, eventId)).toMatchObject({ quotaId: open.id })
        // The outsider is first in line but does not pass the reserved quota; the member does.
        expect(await readOfUser(outsiderWaiting, eventId)).toMatchObject({ state: 'WAITING_LIST' })
        expect(await readOfUser(memberWaiting, eventId)).toMatchObject({ state: 'IN_QUOTA', quotaId: reserved.id })
    })

    test('moving into a full quota, or one of another event, is refused', async () => {
        const { eventId, quotas: [full] } = await createEvent([{ name: 'Alle', places: 1 }])
        const other = await createEvent([{ name: 'Alle', places: 5 }])
        const organiser = await createUser([organisers])
        const seated = await createUser([groupOne])
        const waiting = await createUser([groupOne])

        await register(seated, eventId)
        const waitingRegistration = await register(waiting, eventId)

        await expect(eventRegistrationOperations.moveToQuota({
            params: { registrationId: waitingRegistration.id },
            data: { quotaId: full.id },
            session: sessionOf(organiser),
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        await expect(eventRegistrationOperations.moveToQuota({
            params: { registrationId: waitingRegistration.id },
            data: { quotaId: other.quotas[0].id },
            session: sessionOf(organiser),
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        expect(await readOfUser(waiting, eventId)).toMatchObject({ state: 'WAITING_LIST' })
    })
})

describe('administrating quotas', () => {
    test('quotas are created last in the fill order and read back in it', async () => {
        const { eventId, quotas } = await createEvent([
            { name: 'Første', places: 1 },
            { name: 'Andre', places: 2 },
        ])

        const read = await eventQuotaOperations.readMany({ params: { eventId }, bypassAuth: true })

        expect(read.map(quota => quota.id)).toEqual(quotas.map(quota => quota.id))
        expect(read.map(quota => quota.order)).toEqual([0, 1])
        expect(read[0].visibility).toEqual(everyone)
    })

    test('reordering takes every quota once', async () => {
        const { eventId, quotas: [first, second] } = await createEvent([
            { name: 'Første', places: 1 },
            { name: 'Andre', places: 2 },
        ])

        await expect(eventQuotaOperations.reorder({
            params: { eventId }, data: { quotaIds: [second.id] }, bypassAuth: true,
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))

        await eventQuotaOperations.reorder({
            params: { eventId }, data: { quotaIds: [second.id, first.id] }, bypassAuth: true,
        })

        const read = await eventQuotaOperations.readMany({ params: { eventId }, bypassAuth: true })
        expect(read.map(quota => quota.id)).toEqual([second.id, first.id])
    })

    test('changing quotas takes the admin level of the event', async () => {
        const { eventId, quotas: [quota] } = await createEvent([{ name: 'Alle', places: 1 }])
        const member = await createUser([groupOne])
        const organiser = await createUser([organisers])

        await expect(eventQuotaOperations.update({
            params: { id: quota.id }, data: { places: 2 }, session: sessionOf(member),
        })).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
        await expect(eventQuotaOperations.create({
            params: { eventId },
            data: {
                name: 'Ny',
                places: 1,
                registrationStart: new Date(),
                registrationEnd: new Date(Date.now() + HOUR),
                visibilityRequirements: [],
            },
            session: sessionOf(member),
        })).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))

        await eventQuotaOperations.update({ params: { id: quota.id }, data: { places: 2 }, session: sessionOf(organiser) })
        expect(await prisma.eventRegistrationQuota.findUniqueOrThrow({ where: { id: quota.id } }))
            .toMatchObject({ places: 2 })
    })

    test('a quota must end after it starts, and have a price exactly when the event takes payment', async () => {
        const { eventId, quotas: [quota] } = await createEvent([{ name: 'Alle', places: 1 }])

        await expect(eventQuotaOperations.update({
            params: { id: quota.id },
            data: { registrationStart: new Date(Date.now() + 2 * HOUR), registrationEnd: new Date(Date.now() + HOUR) },
            bypassAuth: true,
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))

        // Without payment the price is dropped; with it, it is required.
        await eventQuotaOperations.update({ params: { id: quota.id }, data: { price: 100 }, bypassAuth: true })
        expect(await prisma.eventRegistrationQuota.findUniqueOrThrow({ where: { id: quota.id } }))
            .toMatchObject({ price: null })

        await expect(eventOperations.update({
            params: { id: eventId },
            data: { takesPayment: true, paymentStart: new Date(), paymentEnd: new Date(Date.now() + HOUR) },
            bypassAuth: true,
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
    })

    test('a quota is only removed once no one holds a place in it, and takes its visibility with it', async () => {
        const { eventId, quotas: [quota, spare] } = await createEvent([
            { name: 'Alle', places: 1 },
            { name: 'Reserve', places: 1 },
        ])
        const member = await createUser([groupOne])
        const registration = await register(member, eventId)

        await expect(eventQuotaOperations.destroy({ params: { id: quota.id }, bypassAuth: true }))
            .rejects.toThrow(new Smorekopp('BAD PARAMETERS'))

        await eventRegistrationOperations.moveToQuota({
            params: { registrationId: registration.id }, data: { quotaId: spare.id }, bypassAuth: true,
        })
        await eventQuotaOperations.destroy({ params: { id: quota.id }, bypassAuth: true })

        expect(await prisma.eventRegistrationQuota.findUnique({ where: { id: quota.id } })).toBeNull()
        expect(await prisma.visibility.findUnique({ where: { id: quota.visibilityId } })).toBeNull()
        expect(await readOfUser(member, eventId)).toMatchObject({ quotaId: spare.id })
    })
})

describe('who sees an event with quotas', () => {
    test('a published event for those who can register is seen by anyone passing a quota', async () => {
        const { eventId } = await createEvent(
            [{ name: 'Gruppe én', places: 5, visibility: activeIn(groupOne) }],
            { canBeViewedBy: 'CAN_REGISTER' },
        )
        const member = await createUser([groupOne])
        const outsider = await createUser([groupTwo])
        const organiser = await createUser([organisers])

        const listedFor = async (testUser: TestUser) => (await eventOperations.readManyCurrent({
            params: { tags: null }, session: sessionOf(testUser),
        })).map(event => event.id)

        await expect(eventOperations.read({ params: { id: eventId }, session: sessionOf(member) }))
            .resolves.toMatchObject({ id: eventId })
        await expect(eventOperations.read({ params: { id: eventId }, session: sessionOf(organiser) }))
            .resolves.toMatchObject({ id: eventId })
        await expect(eventOperations.read({ params: { id: eventId }, session: sessionOf(outsider) }))
            .rejects.toThrow(new Smorekopp('UNAUTHORIZED'))

        expect(await listedFor(member)).toContain(eventId)
        expect(await listedFor(organiser)).toContain(eventId)
        expect(await listedFor(outsider)).not.toContain(eventId)
    })
})
