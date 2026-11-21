import { activeMembersOf, recordSentMail } from 'tests/utils'
import { changeEventSetup } from 'tests/eventSetup'
import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { eventNotificationOperations } from '@/services/events/notifications/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { eventSlotOperations } from '@/services/events/slots/operations'
import { userOperations } from '@/services/users/operations'
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import type { VisibilityRequirement } from '@/services/visibility/types'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const time = {
    eventStart: new Date(Math.floor(Date.now() / HOUR) * HOUR + 48 * HOUR),
    eventEnd: new Date(Math.floor(Date.now() / HOUR) * HOUR + 51 * HOUR),
}
const period = {
    registrationStart: new Date(Date.now() - HOUR),
    registrationEnd: new Date(Date.now() + 24 * HOUR),
    takesPayment: false,
}
const open: VisibilityRequirement[] = []

const refusedWith = (message: string) => ({ errors: [expect.objectContaining({ message })] })

const notifySpy = jest.spyOn(eventNotificationOperations.internal.createInfoNotification, 'internalCall')
let userIds: number[]
let order: number

beforeAll(async () => {
    const users = await Promise.all(Array.from({ length: 6 }, (_, index) => userOperations.create({
        data: {
            email: `slot-registration-${index}@omega.ntnu.no`,
            firstname: 'Test',
            lastname: `Testesen ${index}`,
            username: `slot-registration-${index}`,
            emailVerified: new Date().toISOString(),
        },
        bypassAuth: true,
    })))
    userIds = users.map(user => user.id)
    order = (await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })).order
})

beforeEach(() => {
    notifySpy.mockReset()
    notifySpy.mockResolvedValue({ notification: null })
    recordSentMail()
})

afterAll(() => notifySpy.mockRestore())

/** A group whose active members are the users given, and the requirement of being one. */
async function groupOf(shortName: string, members: number[]): Promise<VisibilityRequirement[]> {
    const group = await prisma.group.create({
        data: { groupType: 'MANUAL_GROUP', order, manualGroup: { create: { name: shortName, shortName } } },
    })
    await prisma.membership.createMany({
        data: members.map(userId => ({ userId, groupId: group.id, admin: false, active: true, order })),
    })
    return [{ conditions: [activeMembersOf(group.id)] }]
}

/**
 * An event with one slotted variant of as many slots as its quotas have places, ten minutes each
 * and five apart.
 */
async function createSlottedEvent(
    name: string,
    quotas: { places: number, visibilityRequirements: VisibilityRequirement[] }[] = [
        { places: 2, visibilityRequirements: open },
    ],
    { waitingList = true, bindingRegistration = false } = {},
) {
    const slotCount = quotas.reduce((sum, quota) => sum + quota.places, 0)
    const event = await eventOperations.create({
        data: { kind: 'ORDINARY', name, location: 'Lophtet', ...time, visibilityAdminRequirements: [{ conditions: [] }] },
        bypassAuth: true,
    })
    await eventOperations.saveSetup({
        params: { id: event.id },
        data: {
            waitingList,
            bindingRegistration,
            variants: [{
                name: 'Påmelding',
                registrationType: 'SLOTTED',
                ...period,
                slotSchedule: {
                    start: time.eventStart,
                    slotMinutes: 10,
                    breakMinutes: 5,
                    totalMinutes: 15 * slotCount - 5,
                    longBreakEveryMinutes: null,
                    longBreakMinutes: null,
                },
                quotas: quotas.map((quota, index) => ({ name: `Kvote ${index}`, ...quota })),
            }],
        },
        bypassAuth: true,
    })
    const variant = await prisma.eventVariant.findFirstOrThrow({
        where: { eventId: event.id },
        include: { quotas: { orderBy: { order: 'asc' } }, slots: { orderBy: { start: 'asc' } } },
    })
    return { eventId: event.id, variant, quotas: variant.quotas, slots: variant.slots }
}

const register = (eventId: number, userId: number, slotId?: number) => eventRegistrationOperations.create({
    params: { eventId, userId, slotId },
    bypassAuth: true,
})

const registerAsAdmin = (eventId: number, userId: number, slotId?: number) => (
    eventRegistrationOperations.createAsAdmin({ params: { eventId, userId, slotId }, bypassAuth: true })
)

const removeAsAdmin = (registrationId: number) => eventRegistrationOperations.destroyAsAdmin({
    params: { registrationId },
    bypassAuth: true,
})

const registrationOf = (userId: number, variantId: number) => prisma.eventRegistration.findFirstOrThrow({
    where: { userId, OR: [{ quota: { variantId } }, { waitingListVariantId: variantId }] },
})

const holderOf = async (slotId: number) => (
    await prisma.eventRegistration.findUnique({ where: { slotId }, select: { userId: true } })
)?.userId ?? null

describe('registering on a slotted variant', () => {
    test('of two who pick the same slot at once, gives it to one and tells the other it is taken', async () => {
        const { eventId, variant, slots } = await createSlottedEvent('Samtidig valg', [
            { places: 8, visibilityRequirements: open },
        ])
        const [first, second] = userIds

        for (let round = 0; round < 24; round++) {
            const slot = slots[round % slots.length]
            const picks = await Promise.allSettled([register(eventId, first, slot.id), register(eventId, second, slot.id)])

            const fulfilled = picks.filter(pick => pick.status === 'fulfilled')
            const rejected = picks.flatMap(pick => (pick.status === 'rejected' ? [pick.reason as unknown] : []))
            expect(fulfilled).toHaveLength(1)
            expect(rejected).toEqual([expect.objectContaining(refusedWith('Tidsluken er tatt. Velg en annen.'))])

            const winner = await holderOf(slot.id)
            expect([first, second]).toContain(winner)
            expect(await prisma.eventRegistration.count({
                where: { OR: [{ quota: { variantId: variant.id } }, { waitingListVariantId: variant.id }] },
            })).toBe(1)
            await removeAsAdmin((await registrationOf(winner!, variant.id)).id)
        }
    })

    test('when full puts the next on the waiting list without a slot, and refuses a taken one', async () => {
        const { eventId, variant, slots } = await createSlottedEvent('Fullt')
        const [first, second, third] = userIds

        await register(eventId, first, slots[0].id)
        await expect(register(eventId, second))
            .rejects.toMatchObject(refusedWith('Det er ledige tidsluker. Velg en av dem.'))
        await register(eventId, second, slots[1].id)
        await expect(register(eventId, third, slots[0].id))
            .rejects.toMatchObject(refusedWith('Tidsluken er tatt. Velg en annen.'))

        expect(await register(eventId, third)).toMatchObject({ state: 'WAITING_LIST', slotId: null })
        expect(await registrationOf(first, variant.id)).toMatchObject({ state: 'IN_QUOTA', slotId: slots[0].id })
        expect(await registrationOf(second, variant.id)).toMatchObject({ state: 'IN_QUOTA', slotId: slots[1].id })
    })

    test('refuses a slot to one whom no quota with a free place lets in', async () => {
        const members = await groupOf('slotmembers', [userIds[0]])
        const { eventId, slots } = await createSlottedEvent('Bare for noen', [
            { places: 1, visibilityRequirements: members },
            { places: 1, visibilityRequirements: open },
        ])

        await register(eventId, userIds[1], slots[1].id)

        await expect(register(eventId, userIds[2], slots[0].id)).rejects.toMatchObject(refusedWith(
            'Ingen av kvotene med ledig plass er åpne for deg, så du kan bare stå på venteliste.'
        ))
        expect(await register(eventId, userIds[2])).toMatchObject({ state: 'WAITING_LIST', slotId: null })
    })

    test('is full without a waiting list once every slot is held', async () => {
        const { eventId, slots } = await createSlottedEvent('Uten venteliste', undefined, { waitingList: false })
        await register(eventId, userIds[0], slots[0].id)
        await register(eventId, userIds[1], slots[1].id)

        await expect(register(eventId, userIds[2])).rejects.toMatchObject(refusedWith('Arrangementet er fullt.'))
    })

    test('refuses a slot of another variant, and a slot on a list variant', async () => {
        const { eventId } = await createSlottedEvent('Egen variant')
        const other = await createSlottedEvent('Annen variant')
        const list = await eventOperations.create({
            data: {
                kind: 'ORDINARY',
                name: 'Liste',
                location: 'Lophtet',
                ...time,
                takesRegistration: true,
                places: 2,
                visibilityAdminRequirements: [{ conditions: [] }],
            },
            bypassAuth: true,
        })

        await expect(register(eventId, userIds[0], other.slots[0].id))
            .rejects.toMatchObject(refusedWith('Tidsluken hører ikke til varianten.'))
        await expect(register(list.id, userIds[0], other.slots[0].id))
            .rejects.toMatchObject(refusedWith('Varianten har ikke tidsluker.'))
    })

    test('gives an administrator and a guest the slot picked for them', async () => {
        const { eventId, variant, slots } = await createSlottedEvent('Administrator og gjest', [
            { places: 3, visibilityRequirements: open },
        ])

        await expect(registerAsAdmin(eventId, userIds[0])).rejects.toMatchObject(
            refusedWith('Det er ledige tidsluker. Velg en av dem.')
        )
        expect(await registerAsAdmin(eventId, userIds[0], slots[2].id)).toMatchObject({
            state: 'IN_QUOTA',
            slotId: slots[2].id,
        })
        expect(await eventRegistrationOperations.createGuest({
            params: { eventId, slotId: slots[0].id },
            data: { name: 'Gjest', note: '' },
            bypassAuth: true,
        })).toMatchObject({ state: 'IN_QUOTA', slotId: slots[0].id })
        await expect(eventRegistrationOperations.createGuest({
            params: { eventId, slotId: slots[0].id },
            data: { name: 'Gjest to', note: '' },
            bypassAuth: true,
        })).rejects.toMatchObject(refusedWith('Tidsluken er tatt. Velg en annen.'))
        expect(await registrationOf(userIds[0], variant.id)).toMatchObject({ slotId: slots[2].id })
    })

    test('reads which slots are free', async () => {
        const { eventId, variant, slots } = await createSlottedEvent('Ledige')
        await register(eventId, userIds[0], slots[1].id)

        expect(await eventSlotOperations.readOfVariant({ params: { variantId: variant.id }, bypassAuth: true })).toEqual([
            { id: slots[0].id, start: slots[0].start, end: slots[0].end, free: true },
            { id: slots[1].id, start: slots[1].start, end: slots[1].end, free: false },
        ])
    })
})

describe('leaving a slotted variant', () => {
    test('follows a binding registration, which only an administrator takes back', async () => {
        const { eventId, slots } = await createSlottedEvent('Bindende', undefined, { bindingRegistration: true })
        const registration = await register(eventId, userIds[0], slots[0].id)

        await expect(eventRegistrationOperations.destroy({ params: { registrationId: registration.id }, bypassAuth: true }))
            .rejects.toMatchObject(refusedWith('Påmeldingen er bindende. Ta kontakt med arrangørene om du ikke kan komme.'))
        expect(await holderOf(slots[0].id)).toBe(userIds[0])

        await removeAsAdmin(registration.id)
        expect(await holderOf(slots[0].id)).toBeNull()
        expect(await register(eventId, userIds[1], slots[0].id)).toMatchObject({ slotId: slots[0].id })
    })
})

describe('a change of places on a slotted variant', () => {
    test('takes the slot of one sent back to the waiting list, and gives it to the one seated in their place', async () => {
        const members = await groupOf('slotmoved', [userIds[1], userIds[2]])
        const { eventId, variant, slots } = await createSlottedEvent('Flytter plasser', [
            { places: 1, visibilityRequirements: open },
            { places: 1, visibilityRequirements: members },
        ])
        await register(eventId, userIds[0], slots[0].id)
        await registerAsAdmin(eventId, userIds[1], slots[1].id)
        await prisma.eventRegistration.create({
            data: { state: 'WAITING_LIST', waitingListVariantId: variant.id, userId: userIds[2] },
        })

        await changeEventSetup(eventId, variants => {
            variants[0].quotas[0].places = 0
            variants[0].quotas[1].places = 2
        })

        expect(await registrationOf(userIds[0], variant.id)).toMatchObject({ state: 'WAITING_LIST', slotId: null })
        expect(await registrationOf(userIds[2], variant.id)).toMatchObject({ state: 'IN_QUOTA', slotId: slots[0].id })
        expect(await holderOf(slots[1].id)).toBe(userIds[1])
    })

    test('gives one an administrator moves off the waiting list a free slot', async () => {
        const members = await groupOf('slotmovedin', [userIds[0]])
        const { eventId, variant, quotas, slots } = await createSlottedEvent('Flyttes inn', [
            { places: 1, visibilityRequirements: members },
            { places: 2, visibilityRequirements: open },
        ])
        await register(eventId, userIds[1], slots[0].id)
        await register(eventId, userIds[2], slots[2].id)
        const waiting = await register(eventId, userIds[3])

        await eventRegistrationOperations.moveToQuota({
            params: { registrationId: waiting.id },
            data: { quotaId: quotas[0].id },
            bypassAuth: true,
        })

        expect(await registrationOf(userIds[3], variant.id)).toMatchObject({
            state: 'IN_QUOTA',
            quotaId: quotas[0].id,
            slotId: slots[1].id,
        })
    })
})

describe('a list variant', () => {
    test('hands out places without slots, and tells the promoted of no slot', async () => {
        const event = await eventOperations.create({
            data: {
                kind: 'ORDINARY',
                name: 'Liste som før',
                location: 'Lophtet',
                ...time,
                takesRegistration: true,
                places: 1,
                waitingList: true,
                ...period,
                visibilityAdminRequirements: [{ conditions: [] }],
            },
            bypassAuth: true,
        })

        const seated = await register(event.id, userIds[0])
        const waiting = await register(event.id, userIds[1])
        expect(seated).toMatchObject({ state: 'IN_QUOTA', slotId: null })
        expect(waiting).toMatchObject({ state: 'WAITING_LIST', slotId: null })

        await removeAsAdmin(seated.id)
        expect(await prisma.eventRegistration.findUniqueOrThrow({ where: { id: waiting.id } }))
            .toMatchObject({ state: 'IN_QUOTA', slotId: null })
        expect(notifySpy).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ message: expect.stringContaining('arrangementet Liste som før. Hvis') }),
        }))
    })
})
