import { changeEventSetup, removeQuota, removeVariant, setQuotaPlaces } from 'tests/eventSetup'
import { Session } from '@/auth/session/Session'
import { newQuotaDraft, newVariantDraft } from '@/components/Event/eventSetupDraft'
import { ServiceError, Smorekopp } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import { eventNotificationOperations } from '@/services/events/notifications/operations'
import { eventOperations } from '@/services/events/operations'
import { eventQuotaOperations } from '@/services/events/quotas/operations'
import { eventVariantOperations } from '@/services/events/variants/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { userOperations } from '@/services/users/operations'
import { beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import type { MembershipFiltered } from '@/services/groups/types'
import type { VisibilityMatrix } from '@/services/visibility/types'
import type { EventCanView } from '@/prisma-generated-pn-types'

/**
 * Events with variants and several quotas: how the places fill and refill, and how they are
 * administrated. Single-quota events, which behave as events always did, are covered by
 * eventRegistration.test.ts.
 */

const HOUR = 60 * 60 * 1000

let currentOrder: number
let groupOne: number
let groupTwo: number
let organisers: number
let userCounter = 0

const notifySpy = jest.spyOn(eventNotificationOperations.internal.createInfoNotification, 'internalCall')

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

/** A user with real memberships in the groups, which the place-fixing pass reads. */
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

type QuotaSpec = { name: string, places: number, visibility?: VisibilityMatrix }
type VariantSpec = { name?: string, quotas: QuotaSpec[], registrationStart?: Date, registrationEnd?: Date }

/** A published event organised by `organisers`, with the variants and their quotas in the order given. */
async function createEvent(
    variantSpecs: VariantSpec[],
    { waitingList = true, canBeViewedBy = 'ALL', allowMultiple = false }: {
        waitingList?: boolean, canBeViewedBy?: EventCanView, allowMultiple?: boolean,
    } = {},
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
            allowRegistrationInMultipleVariants: allowMultiple,
            tagIds: [],
            visibilityAdminRequirements: activeIn(organisers).requirements,
        },
        bypassAuth: true,
    })
    const variants = []
    for (const spec of variantSpecs) {
        const variant = await eventVariantOperations.internal.create.internalCall({
            params: { eventId: event.id },
            data: {
                name: spec.name ?? 'Påmelding',
                registrationStart: spec.registrationStart ?? new Date(Date.now() - HOUR),
                registrationEnd: spec.registrationEnd ?? new Date(Date.now() + 24 * HOUR),
            },
        })
        const quotas = []
        for (const quota of spec.quotas) {
            quotas.push(await eventQuotaOperations.internal.create.internalCall({
                params: { variantId: variant.id },
                data: {
                    name: quota.name,
                    places: quota.places,
                    visibilityRequirements: (quota.visibility ?? everyone).requirements,
                },
            }))
        }
        variants.push({ ...variant, quotas })
    }
    // An event without registration may not have a waiting list, so it is switched on once the quotas are there.
    await eventOperations.update({ params: { id: event.id }, data: { waitingList }, bypassAuth: true })
    await eventOperations.setPublished({ params: { id: event.id }, data: { published: true }, bypassAuth: true })
    return { eventId: event.id, variants }
}

/** One variant with the quotas given, the common case. */
async function createEventWithQuotas(quotas: QuotaSpec[], options?: Parameters<typeof createEvent>[1]) {
    const { eventId, variants: [variant] } = await createEvent([{ quotas }], options)
    return { eventId, variantId: variant.id, quotas: variant.quotas }
}

const register = (testUser: TestUser, eventId: number, variantId?: number) => eventRegistrationOperations.create({
    params: { userId: testUser.user.id, eventId, variantId },
    session: sessionOf(testUser),
})

const readOfUser = (testUser: TestUser, eventId: number, variantId?: number) => eventRegistrationOperations.readOfUser({
    params: { eventId, userId: testUser.user.id, variantId },
    bypassAuth: true,
})

// The audience may be given as JSON from a form, which the promotions never do.
const promotedUserIds = () => notifySpy.mock.calls.flatMap(([call]) => (
    typeof call.data.audience === 'object' ? call.data.audience.userIds ?? [] : []
))

beforeAll(async () => {
    currentOrder = (await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })).order
    groupOne = await createManualGroup('quota-group-one')
    groupTwo = await createManualGroup('quota-group-two')
    organisers = await createManualGroup('quota-organisers')
})

beforeEach(() => {
    notifySpy.mockReset()
    notifySpy.mockResolvedValue({ notification: null })
})

describe('filling several quotas', () => {
    test('a registrant takes the first quota in order they pass that has a place', async () => {
        const { eventId, quotas: [reserved, open] } = await createEventWithQuotas([
            { name: 'Gruppe én', places: 1, visibility: activeIn(groupOne) },
            { name: 'Alle', places: 1 },
        ])
        const firstMember = await createUser([groupOne])
        const secondMember = await createUser([groupOne])
        const outsider = await createUser([groupTwo])

        expect(await register(firstMember, eventId)).toMatchObject({ state: 'IN_QUOTA', quotaId: reserved.id })
        expect(await register(secondMember, eventId)).toMatchObject({ state: 'IN_QUOTA', quotaId: open.id })
        expect(await register(outsider, eventId)).toMatchObject({ state: 'WAITING_LIST' })
        // Registering is not a promotion.
        expect(promotedUserIds()).toEqual([])
    })

    test('a quota the registrant does not pass is skipped even with places left', async () => {
        const { eventId, quotas: [, open] } = await createEventWithQuotas([
            { name: 'Gruppe én', places: 5, visibility: activeIn(groupOne) },
            { name: 'Alle', places: 5 },
        ])
        const outsider = await createUser([groupTwo])

        expect(await register(outsider, eventId)).toMatchObject({ state: 'IN_QUOTA', quotaId: open.id })
    })

    test('passing no quota at all refuses registration', async () => {
        const { eventId } = await createEventWithQuotas([{ name: 'Gruppe én', places: 5, visibility: activeIn(groupOne) }])
        const outsider = await createUser([groupTwo])

        await expect(register(outsider, eventId)).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
    })

    test('the registration period is the variant\'s', async () => {
        const { eventId } = await createEvent([{
            quotas: [{ name: 'Alle', places: 5 }],
            registrationStart: new Date(Date.now() + HOUR),
        }])
        const member = await createUser([groupOne])

        await expect(register(member, eventId)).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        expect(await readOfUser(member, eventId)).toBeNull()
    })

    test('an administrator puts someone into the quota they name, places permitting', async () => {
        const { eventId, quotas: [reserved, open] } = await createEventWithQuotas([
            { name: 'Gruppe én', places: 1, visibility: activeIn(groupOne) },
            { name: 'Alle', places: 5 },
        ])
        const organiser = await createUser([organisers])
        const outsider = await createUser([groupTwo])
        const another = await createUser([groupTwo])

        await eventRegistrationOperations.createAsAdmin({
            params: { userId: outsider.user.id, eventId, quotaId: reserved.id },
            session: sessionOf(organiser),
        })
        expect(await readOfUser(outsider, eventId)).toMatchObject({ quotaId: reserved.id })

        await expect(eventRegistrationOperations.createAsAdmin({
            params: { userId: another.user.id, eventId, quotaId: reserved.id },
            session: sessionOf(organiser),
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))

        await eventRegistrationOperations.createAsAdmin({
            params: { userId: another.user.id, eventId },
            session: sessionOf(organiser),
        })
        expect(await readOfUser(another, eventId)).toMatchObject({ quotaId: open.id })
    })
})

describe('refilling places', () => {
    test('a freed place skips those on the waiting list who do not pass the quota', async () => {
        const { eventId } = await createEventWithQuotas([{ name: 'Gruppe én', places: 1, visibility: activeIn(groupOne) }])
        const organiser = await createUser([organisers])
        const seated = await createUser([groupOne])
        const outsiderWaiting = await createUser([groupTwo])
        const memberWaiting = await createUser([groupOne])

        const seatedRegistration = await register(seated, eventId)
        await eventRegistrationOperations.createAsAdmin({
            params: { userId: outsiderWaiting.user.id, eventId }, session: sessionOf(organiser),
        })
        await register(memberWaiting, eventId)
        expect(await readOfUser(outsiderWaiting, eventId)).toMatchObject({ state: 'WAITING_LIST' })

        await eventRegistrationOperations.destroy({
            params: { registrationId: seatedRegistration.id }, session: sessionOf(seated),
        })

        expect(await readOfUser(outsiderWaiting, eventId)).toMatchObject({ state: 'WAITING_LIST' })
        expect(await readOfUser(memberWaiting, eventId)).toMatchObject({ state: 'IN_QUOTA' })
        expect(promotedUserIds()).toEqual([memberWaiting.user.id])
    })

    test('a freed place in a higher quota is taken from the quota below, whose place goes to the waiting list', async () => {
        const { eventId, quotas: [reserved, open] } = await createEventWithQuotas([
            { name: 'Gruppe én', places: 1, visibility: activeIn(groupOne) },
            { name: 'Alle', places: 1 },
        ])
        const first = await createUser([groupOne])
        const second = await createUser([groupOne])
        const waiting = await createUser([groupTwo])

        const firstRegistration = await register(first, eventId)
        await register(second, eventId)
        await register(waiting, eventId)
        expect(await readOfUser(second, eventId)).toMatchObject({ quotaId: open.id })

        await eventRegistrationOperations.destroy({
            params: { registrationId: firstRegistration.id }, session: sessionOf(first),
        })

        expect(await readOfUser(second, eventId)).toMatchObject({ quotaId: reserved.id })
        expect(await readOfUser(waiting, eventId)).toMatchObject({ state: 'IN_QUOTA', quotaId: open.id })
        // Only the one taken off the waiting list is told.
        expect(promotedUserIds()).toEqual([waiting.user.id])
    })

    test('a new quota takes those waiting who pass it, in queue order', async () => {
        const { eventId, variantId } = await createEventWithQuotas([{ name: 'Alle', places: 1 }])
        const filler = await createUser([groupTwo])
        const outsider = await createUser([groupTwo])
        const member = await createUser([groupOne])
        const laterMember = await createUser([groupOne])
        await register(filler, eventId)
        await register(outsider, eventId)
        await register(member, eventId)
        await register(laterMember, eventId)

        await changeEventSetup(eventId, ([variant]) => {
            variant.quotas.push({
                ...newQuotaDraft('Gruppe én', variant.quotas, activeIn(groupOne).requirements),
                places: 1,
            })
        })
        const quota = await prisma.eventQuota.findFirstOrThrow({ where: { variantId, name: 'Gruppe én' } })

        expect(await readOfUser(member, eventId)).toMatchObject({ state: 'IN_QUOTA', quotaId: quota.id })
        expect(await readOfUser(laterMember, eventId)).toMatchObject({ state: 'WAITING_LIST' })
        expect(await readOfUser(outsider, eventId)).toMatchObject({ state: 'WAITING_LIST' })
        expect(promotedUserIds()).toEqual([member.user.id])
    })

    test('widening a quota\'s visibility takes those waiting who now pass it', async () => {
        const { eventId, quotas: [quota] } = await createEventWithQuotas([
            { name: 'Gruppe én', places: 1, visibility: activeIn(groupOne) },
        ])
        const organiser = await createUser([organisers])
        const member = await createUser([groupOne])
        const outsider = await createUser([groupTwo])
        await register(member, eventId)
        await eventRegistrationOperations.createAsAdmin({
            params: { userId: outsider.user.id, eventId }, session: sessionOf(organiser),
        })
        // A second place does not seat the outsider while the quota is not theirs.
        await setQuotaPlaces(quota.id, 2)
        expect(await readOfUser(outsider, eventId)).toMatchObject({ state: 'WAITING_LIST' })

        await eventQuotaOperations.visibility.update({
            implementationParams: { id: quota.id },
            params: { visibilityId: quota.visibilityId },
            data: everyone,
            bypassAuth: true,
        })

        expect(await readOfUser(outsider, eventId)).toMatchObject({ state: 'IN_QUOTA', quotaId: quota.id })
        expect(promotedUserIds()).toEqual([outsider.user.id])
    })

    test('fewer places take the last unpaid places back, never a paid one', async () => {
        const { eventId, quotas: [quota] } = await createEventWithQuotas([{ name: 'Alle', places: 3 }])
        const first = await createUser([groupOne])
        const paying = await createUser([groupOne])
        const last = await createUser([groupOne])
        await register(first, eventId)
        const paid = await register(paying, eventId)
        await register(last, eventId)
        await prisma.eventRegistration.update({ where: { id: paid.id }, data: { manuallyPaid: true } })

        await setQuotaPlaces(quota.id, 2)
        expect(await readOfUser(last, eventId)).toMatchObject({ state: 'WAITING_LIST' })

        await setQuotaPlaces(quota.id, 1)
        expect(await readOfUser(first, eventId)).toMatchObject({ state: 'WAITING_LIST' })
        expect(await readOfUser(paying, eventId)).toMatchObject({ state: 'IN_QUOTA' })

        await expect(setQuotaPlaces(quota.id, 0))
            .rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        expect(await readOfUser(paying, eventId)).toMatchObject({ state: 'IN_QUOTA' })
        expect(promotedUserIds()).toEqual([])
    })

    test('more places take the first waiting', async () => {
        const { eventId, quotas: [quota] } = await createEventWithQuotas([{ name: 'Alle', places: 1 }])
        const seated = await createUser([groupOne])
        const waiting = await createUser([groupOne])
        await register(seated, eventId)
        await register(waiting, eventId)

        await setQuotaPlaces(quota.id, 2)

        expect(await readOfUser(waiting, eventId)).toMatchObject({ state: 'IN_QUOTA' })
        expect(promotedUserIds()).toEqual([waiting.user.id])
    })
})

describe('several variants', () => {
    test('a user picks the variant, and may wait on several but hold a place in one', async () => {
        const { eventId, variants: [first, second] } = await createEvent([
            { name: 'Runde 1', quotas: [{ name: 'Alle', places: 1 }] },
            { name: 'Runde 2', quotas: [{ name: 'Alle', places: 1 }] },
        ])
        const fillerOfFirst = await createUser([groupOne])
        const fillerOfSecond = await createUser([groupOne])
        const user = await createUser([groupOne])

        await expect(register(user, eventId)).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))

        await register(fillerOfFirst, eventId, first.id)
        await register(fillerOfSecond, eventId, second.id)
        await expect(register(fillerOfFirst, eventId, first.id)).rejects.toThrow(new Smorekopp('DUPLICATE'))
        // Holding a place in one variant, not even the waiting list of another is open.
        await expect(register(fillerOfFirst, eventId, second.id)).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))

        await register(user, eventId, first.id)
        await register(user, eventId, second.id)
        expect(await readOfUser(user, eventId, first.id)).toMatchObject({ state: 'WAITING_LIST' })
        expect(await readOfUser(user, eventId, second.id)).toMatchObject({ state: 'WAITING_LIST' })
    })

    test('taken off one waiting list, the user leaves the others unless the event allows several places', async () => {
        const { eventId, variants: [first, second] } = await createEvent([
            { name: 'Runde 1', quotas: [{ name: 'Alle', places: 1 }] },
            { name: 'Runde 2', quotas: [{ name: 'Alle', places: 1 }] },
        ])
        const fillerOfFirst = await createUser([groupOne])
        const fillerOfSecond = await createUser([groupOne])
        const user = await createUser([groupOne])
        const fillerRegistration = await register(fillerOfFirst, eventId, first.id)
        await register(fillerOfSecond, eventId, second.id)
        await register(user, eventId, first.id)
        await register(user, eventId, second.id)

        await eventRegistrationOperations.destroy({
            params: { registrationId: fillerRegistration.id }, session: sessionOf(fillerOfFirst),
        })

        expect(await readOfUser(user, eventId, first.id)).toMatchObject({ state: 'IN_QUOTA' })
        expect(await readOfUser(user, eventId, second.id)).toBeNull()
        await expect(register(user, eventId, second.id)).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
    })

    test('an event allowing several places lets the user keep every registration', async () => {
        const { eventId, variants: [first, second] } = await createEvent([
            { name: 'Runde 1', quotas: [{ name: 'Alle', places: 1 }] },
            { name: 'Runde 2', quotas: [{ name: 'Alle', places: 1 }] },
        ], { allowMultiple: true })
        const user = await createUser([groupOne])

        await register(user, eventId, first.id)
        await register(user, eventId, second.id)

        expect(await readOfUser(user, eventId, first.id)).toMatchObject({ state: 'IN_QUOTA' })
        expect(await readOfUser(user, eventId, second.id)).toMatchObject({ state: 'IN_QUOTA' })
    })

    test('a registration is only moved to a quota of its own variant', async () => {
        const { eventId, variants: [first, second] } = await createEvent([
            { name: 'Runde 1', quotas: [{ name: 'Alle', places: 1 }] },
            { name: 'Runde 2', quotas: [{ name: 'Alle', places: 1 }] },
        ])
        const user = await createUser([groupOne])
        const registration = await register(user, eventId, first.id)

        await expect(eventRegistrationOperations.moveToQuota({
            params: { registrationId: registration.id },
            data: { quotaId: second.quotas[0].id },
            bypassAuth: true,
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
    })
    test('seated by an administrator from the waiting list, the user leaves the other waiting lists', async () => {
        const { eventId, variants: [first, second] } = await createEvent([
            { name: 'Runde 1', quotas: [{ name: 'Alle', places: 1 }] },
            { name: 'Runde 2', quotas: [
                { name: 'Alle', places: 1 },
                { name: 'Gruppe én', places: 1, visibility: activeIn(groupOne) },
            ] },
        ])
        const fillerOfFirst = await createUser([groupTwo])
        const fillerOfSecond = await createUser([groupTwo])
        const user = await createUser([groupTwo])
        await register(fillerOfFirst, eventId, first.id)
        await register(fillerOfSecond, eventId, second.id)
        await register(user, eventId, first.id)
        const waitingInSecond = await register(user, eventId, second.id)
        expect(await readOfUser(user, eventId, second.id)).toMatchObject({ state: 'WAITING_LIST' })

        // The reserved quota has a place the user does not pass, which an administrator gives them anyway.
        await eventRegistrationOperations.moveToQuota({
            params: { registrationId: waitingInSecond.id },
            data: { quotaId: second.quotas[1].id },
            bypassAuth: true,
        })

        expect(await readOfUser(user, eventId, second.id)).toMatchObject({ state: 'IN_QUOTA', quotaId: second.quotas[1].id })
        expect(await readOfUser(user, eventId, first.id)).toBeNull()
    })

    test('seated by an administrator from the waiting list, the user is told', async () => {
        const { eventId, variants: [variant] } = await createEvent([
            { name: 'Runde 1', quotas: [
                { name: 'Alle', places: 1 },
                { name: 'Gruppe én', places: 1, visibility: activeIn(groupOne) },
            ] },
        ])
        const filler = await createUser([groupTwo])
        const user = await createUser([groupTwo])
        await register(filler, eventId, variant.id)
        const waiting = await register(user, eventId, variant.id)
        expect(await readOfUser(user, eventId, variant.id)).toMatchObject({ state: 'WAITING_LIST' })

        await eventRegistrationOperations.moveToQuota({
            params: { registrationId: waiting.id },
            data: { quotaId: variant.quotas[1].id },
            bypassAuth: true,
        })

        expect(promotedUserIds()).toEqual([user.user.id])
    })

    test('seated directly by an administrator in another variant, the user leaves the waiting list', async () => {
        const { eventId, variants: [first, second] } = await createEvent([
            { name: 'Runde 1', quotas: [{ name: 'Alle', places: 1 }] },
            { name: 'Runde 2', quotas: [{ name: 'Gruppe én', places: 1, visibility: activeIn(groupOne) }] },
        ])
        const organiser = await createUser([organisers])
        const filler = await createUser([groupTwo])
        const user = await createUser([groupTwo])
        await register(filler, eventId, first.id)
        await register(user, eventId, first.id)
        expect(await readOfUser(user, eventId, first.id)).toMatchObject({ state: 'WAITING_LIST' })

        await eventRegistrationOperations.createAsAdmin({
            params: { userId: user.user.id, eventId, variantId: second.id, quotaId: second.quotas[0].id },
            session: sessionOf(organiser),
        })

        expect(await readOfUser(user, eventId, second.id)).toMatchObject({ state: 'IN_QUOTA' })
        expect(await readOfUser(user, eventId, first.id)).toBeNull()
    })
})

describe('administrating variants and quotas', () => {
    test('moving a registration down is refused when the quota it leaves takes it back', async () => {
        const { eventId, quotas: [upper, lower] } = await createEventWithQuotas([
            { name: 'Øverst', places: 1 },
            { name: 'Nederst', places: 1 },
        ])
        const user = await createUser([groupOne])
        const registration = await register(user, eventId)
        expect(await readOfUser(user, eventId)).toMatchObject({ quotaId: upper.id })

        await expect(eventRegistrationOperations.moveToQuota({
            params: { registrationId: registration.id },
            data: { quotaId: lower.id },
            bypassAuth: true,
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        expect(await readOfUser(user, eventId)).toMatchObject({ quotaId: upper.id })
    })

    test('variants and quotas are created last in order and read back in it', async () => {
        const { eventId, variants } = await createEvent([
            { name: 'Runde 1', quotas: [{ name: 'Første', places: 1 }, { name: 'Andre', places: 2 }] },
            { name: 'Runde 2', quotas: [{ name: 'Alle', places: 3 }] },
        ])

        const read = await eventVariantOperations.readMany({ params: { eventId }, bypassAuth: true })

        expect(read.map(variant => variant.id)).toEqual(variants.map(variant => variant.id))
        expect(read.map(variant => variant.order)).toEqual([0, 1])
        expect(read[0].quotas.map(quota => quota.order)).toEqual([0, 1])
        expect(read[0].quotas[0].visibility).toEqual(everyone)
        expect(read[1]).toMatchObject({ places: 3, takesRegistration: true })
    })

    test('reordering takes every quota once', async () => {
        const { variantId, quotas: [first, second] } = await createEventWithQuotas([
            { name: 'Første', places: 1 },
            { name: 'Andre', places: 2 },
        ])

        await expect(eventQuotaOperations.internal.reorder.internalCall({
            params: { variantId }, data: { quotaIds: [second.id] },
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))

        await eventQuotaOperations.internal.reorder.internalCall({
            params: { variantId }, data: { quotaIds: [second.id, first.id] },
        })

        const read = await eventQuotaOperations.readMany({ params: { variantId }, bypassAuth: true })
        expect(read.map(quota => quota.id)).toEqual([second.id, first.id])
    })

    test('changing variants and quotas takes the admin level of the event', async () => {
        const { eventId, variantId, quotas: [quota] } = await createEventWithQuotas([{ name: 'Alle', places: 1 }])
        const member = await createUser([groupOne])
        const organiser = await createUser([organisers])

        await expect(setQuotaPlaces(quota.id, 2, sessionOf(member))).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
        await expect(changeEventSetup(eventId, variants => {
            variants.push(newVariantDraft('Ny', new Date(Date.now() + HOUR), variants))
        }, sessionOf(member))).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))

        await setQuotaPlaces(quota.id, 2, sessionOf(organiser))
        await expect(eventQuotaOperations.readMany({ params: { variantId }, session: sessionOf(organiser) }))
            .resolves.toMatchObject([{ places: 2 }])
    })

    test('a variant must end after it starts', async () => {
        const { variantId } = await createEventWithQuotas([{ name: 'Alle', places: 1 }])

        await expect(eventVariantOperations.internal.update.internalCall({
            params: { id: variantId },
            data: { registrationStart: new Date(Date.now() + 2 * HOUR), registrationEnd: new Date(Date.now() + HOUR) },
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
    })

    test('a quota or variant is only removed once no one is registered to it', async () => {
        const { eventId, variantId, quotas: [quota, spare] } = await createEventWithQuotas([
            { name: 'Alle', places: 1 },
            { name: 'Reserve', places: 1 },
        ])
        const member = await createUser([groupOne])
        const registration = await register(member, eventId)

        await expect(removeQuota(quota.id))
            .rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        await expect(removeVariant(variantId))
            .rejects.toThrow(new Smorekopp('BAD PARAMETERS'))

        // Cutting the places moves the member on to the next quota they pass, which empties this one.
        await setQuotaPlaces(quota.id, 0)
        expect(await readOfUser(member, eventId)).toMatchObject({ state: 'IN_QUOTA', quotaId: spare.id })
        await removeQuota(quota.id)
        expect(await prisma.eventQuota.findUnique({ where: { id: quota.id } })).toBeNull()
        expect(await prisma.visibility.findUnique({ where: { id: quota.visibilityId } })).toBeNull()

        await eventRegistrationOperations.destroyAsAdmin({ params: { registrationId: registration.id }, bypassAuth: true })
        await removeVariant(variantId)
        expect(await prisma.eventQuota.findUnique({ where: { id: spare.id } })).toBeNull()
        expect(await prisma.visibility.findUnique({ where: { id: spare.visibilityId } })).toBeNull()
    })
})

describe('who sees an event with quotas', () => {
    test('an event seen only by those who can register keeps a quota once published', async () => {
        await expect(createEvent([], { canBeViewedBy: 'CAN_REGISTER' })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))

        const { eventId: openEvent } = await createEvent([])
        await expect(eventOperations.update({
            params: { id: openEvent }, data: { canBeViewedBy: 'CAN_REGISTER' }, bypassAuth: true,
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))

        // A quota without places is how an event for members only, without registration, is seen.
        const { eventId, variantId, quotas: [quota] } = await createEventWithQuotas(
            [{ name: 'Gruppe én', places: 0, visibility: activeIn(groupOne) }],
            { canBeViewedBy: 'CAN_REGISTER' },
        )
        await expect(removeQuota(quota.id))
            .rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        await expect(removeVariant(variantId))
            .rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        await eventOperations.update({ params: { id: eventId }, data: { canBeViewedBy: 'ALL' }, bypassAuth: true })
        await removeVariant(variantId)
        expect(await prisma.eventQuota.findUnique({ where: { id: quota.id } })).toBeNull()
    })

    test('a published event for those who can register is seen by anyone passing a quota', async () => {
        const { eventId } = await createEventWithQuotas(
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

describe('notifications are written with the change they report', () => {
    const failure = new ServiceError('SERVER ERROR', 'Could not write the notification')

    test('a failed change notice rolls back the update', async () => {
        const { eventId } = await createEvent([{ quotas: [{ name: 'Alle', places: 1 }] }])
        notifySpy.mockRejectedValueOnce(failure)

        await expect(eventOperations.update({
            params: { id: eventId },
            data: { name: 'Nytt navn', location: 'Et annet sted', notifyAboutChange: true },
            bypassAuth: true,
        })).rejects.toBe(failure)

        const event = await prisma.event.findUniqueOrThrow({
            where: { id: eventId },
            include: { notificationChannel: true },
        })
        expect(event.location).toBe('Lophtet')
        expect(event.notificationChannel.name).toContain('Kvotearrangement')
    })

    test('a failed announcement leaves the event a draft, so publishing again announces it', async () => {
        const { eventId } = await createEvent([{ quotas: [{ name: 'Alle', places: 1 }] }])
        await eventOperations.setPublished({ params: { id: eventId }, data: { published: false }, bypassAuth: true })
        const announceSpy = jest.spyOn(eventNotificationOperations.internal.createOwnNotification, 'internalCall')
        announceSpy.mockRejectedValueOnce(failure)

        await expect(eventOperations.setPublished({
            params: { id: eventId },
            data: { published: true },
            bypassAuth: true,
        })).rejects.toBe(failure)
        expect((await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).published).toBe(false)

        await eventOperations.setPublished({ params: { id: eventId }, data: { published: true }, bypassAuth: true })
        expect((await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).published).toBe(true)
        expect(announceSpy).toHaveBeenCalledTimes(2)

        announceSpy.mockRestore()
    })
})
