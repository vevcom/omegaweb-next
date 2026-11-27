import { activeMembersOf, recordSentMail, testSession } from 'tests/utils'
import { toVariantDrafts, variantsToPost, withPlacesOfSlots } from '@/services/events/setupDraft'
import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { eventNotificationOperations } from '@/services/events/notifications/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { displaySlot } from '@/services/events/slots/display'
import { eventSlotOperations } from '@/services/events/slots/operations'
import { userOperations } from '@/services/users/operations'
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import type { VariantDraft } from '@/services/events/setupDraft'
import type { SlotSchedule } from '@/services/events/slots/types'
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

/** Slots of ten minutes, five apart, from the start of the event. */
const scheduleOf = (slotCount: number, changes: Partial<SlotSchedule> = {}): SlotSchedule => ({
    start: time.eventStart,
    slotMinutes: 10,
    breakMinutes: 5,
    totalMinutes: 15 * slotCount - 5,
    longBreakEveryMinutes: null,
    longBreakMinutes: null,
    ...changes,
})
const at = (minutes: number) => new Date(time.eventStart.getTime() + minutes * MINUTE)

const refusedWith = (message: string) => ({ errors: [expect.objectContaining({ message })] })

const notifySpy = jest.spyOn(eventNotificationOperations.internal.createInfoNotification, 'internalCall')
let userIds: number[]
let order: number
let sentMail: ReturnType<typeof recordSentMail>

beforeAll(async () => {
    const users = await Promise.all(Array.from({ length: 5 }, (_, index) => userOperations.create({
        data: {
            email: `slot-admin-${index}@omega.ntnu.no`,
            firstname: 'Test',
            lastname: `Testesen ${index}`,
            username: `slot-admin-${index}`,
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
    sentMail = recordSentMail()
})

afterAll(() => notifySpy.mockRestore())

async function groupOf(shortName: string, members: number[]): Promise<VisibilityRequirement[]> {
    const group = await prisma.group.create({
        data: { groupType: 'MANUAL_GROUP', order, manualGroup: { create: { name: shortName, shortName } } },
    })
    await prisma.membership.createMany({
        data: members.map(userId => ({ userId, groupId: group.id, admin: false, active: true, order })),
    })
    return [{ conditions: [activeMembersOf(group.id)] }]
}

/** An event with one slotted variant of as many slots as its quotas have places. */
async function createSlottedEvent(
    name: string,
    quotas: { places: number, visibilityRequirements: VisibilityRequirement[] }[] = [
        { places: 3, visibilityRequirements: open },
    ],
) {
    const event = await eventOperations.create({
        data: { kind: 'ORDINARY', name, location: 'Lophtet', ...time, visibilityAdminRequirements: [{ conditions: [] }] },
        bypassAuth: true,
    })
    await eventOperations.saveSetup({
        params: { id: event.id },
        data: {
            waitingList: true,
            variants: [{
                name: 'Påmelding',
                registrationType: 'SLOTTED',
                ...period,
                slotSchedule: scheduleOf(quotas.reduce((sum, quota) => sum + quota.places, 0)),
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

const registerGuest = (eventId: number, slotId: number, email: string) => (
    eventRegistrationOperations.createGuest({
        params: { eventId, slotId },
        data: { name: 'Gjest', note: '' },
        bypassAuth: true,
    }).then(async registration => {
        await prisma.contactDetails.update({ where: { id: registration.contactId! }, data: { email } })
        return registration
    })
)

const moveAsAdmin = (registrationId: number, slotId: number) => eventRegistrationOperations.moveToSlotAsAdmin({
    params: { registrationId },
    data: { slotId },
    bypassAuth: true,
})

/** The variants as the form holds them, with the slots it reads for its administrators. */
async function draftsOf(eventId: number) {
    const { variants } = await eventOperations.read({ params: { id: eventId }, bypassAuth: true })
    const boards = await Promise.all(variants.map(async variant => [
        variant.id,
        await eventSlotOperations.readBoard({ params: { variantId: variant.id }, bypassAuth: true }),
    ] as const))
    return toVariantDrafts(
        variants,
        Object.fromEntries(boards.map(([id, board]) => [id, board.slots])),
        Object.fromEntries(boards.map(([id, board]) => [id, board.waiting])),
    )
}

/** Saves a new schedule for the first variant as the form does, after the change given to its draft. */
async function changeSchedule(
    eventId: number,
    schedule: SlotSchedule,
    change: (variant: VariantDraft) => void = () => {},
    notifyAboutChange?: boolean,
) {
    const [variant] = await draftsOf(eventId)
    const changed = withPlacesOfSlots({ ...variant, slotSchedule: schedule })
    change(changed)
    return await eventOperations.saveSetup({
        params: { id: eventId },
        data: { variants: variantsToPost([changed]), notifyAboutChange },
        bypassAuth: true,
    })
}

/** Saves a new schedule for the first variant with the placing given as it is posted. */
async function postPlacing(
    eventId: number,
    schedule: SlotSchedule,
    slotPlacing: ReturnType<typeof variantsToPost>[number]['slotPlacing'],
) {
    const [variant] = await draftsOf(eventId)
    const [posted] = variantsToPost([withPlacesOfSlots({ ...variant, slotSchedule: schedule })])
    return await eventOperations.saveSetup({
        params: { id: eventId },
        data: { variants: [{ ...posted, slotPlacing }] },
        bypassAuth: true,
    })
}

const slotsOf = (variantId: number) => prisma.eventSlot.findMany({ where: { variantId }, orderBy: { start: 'asc' } })

const registrationOf = (userId: number, variantId: number) => prisma.eventRegistration.findFirstOrThrow({
    where: { userId, OR: [{ quota: { variantId } }, { waitingListVariantId: variantId }] },
    include: { slot: true },
})

const holderOf = async (slotId: number) => (
    await prisma.eventRegistration.findUnique({ where: { slotId }, select: { userId: true } })
)?.userId ?? null

const after = async <Result>(milliseconds: number, run: () => Promise<Result>) => {
    await new Promise(resolve => setTimeout(resolve, milliseconds))
    return await run()
}

/**
 * What must hold of a slotted variant after any change: everyone seated holds a slot of its own of
 * the variant, no one waiting holds one, and the quotas have a place for each slot.
 */
async function expectSlotsInStep(variantId: number) {
    const [registrations, slots, quotas] = await Promise.all([
        prisma.eventRegistration.findMany({
            where: { OR: [{ quota: { variantId } }, { waitingListVariantId: variantId }] },
        }),
        slotsOf(variantId),
        prisma.eventQuota.findMany({ where: { variantId } }),
    ])
    const seated = registrations.filter(registration => registration.state === 'IN_QUOTA')
    const held = seated.map(registration => registration.slotId)
    expect(held.every(slotId => slots.some(slot => slot.id === slotId))).toBe(true)
    expect(new Set(held).size).toBe(held.length)
    expect(registrations.filter(registration => registration.state === 'WAITING_LIST')
        .every(registration => registration.slotId === null)).toBe(true)
    expect(quotas.reduce((sum, quota) => sum + quota.places, 0)).toBe(slots.length)
}

/** The users each notification went to, so that no one is seen twice. */
const notifiedUsers = () => notifySpy.mock.calls.flatMap(([call]) => (
    (call as { data: { audience: { userIds?: number[] } } }).data.audience.userIds ?? []
))

const notifiedWith = (userId: number, message: string) => expect(notifySpy).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ audience: { userIds: [userId] }, message: expect.stringContaining(message) }),
}))

describe('a schedule changed with people in it', () => {
    test('places each where they are put, and tells each whose time changed of their new slot once', async () => {
        const { eventId, variant, slots } = await createSlottedEvent('Ny timeplan')
        const [moved, followed, , waiting] = userIds
        await register(eventId, moved, slots[0].id)
        await register(eventId, followed, slots[1].id)
        await registerGuest(eventId, slots[2].id, 'slot-admin-guest@example.com')
        await prisma.eventRegistration.create({
            data: { state: 'WAITING_LIST', waitingListVariantId: variant.id, userId: waiting },
        })
        const movedRegistration = await registrationOf(moved, variant.id)
        const guest = await prisma.eventRegistration.findUniqueOrThrow({ where: { slotId: slots[2].id } })

        // Four slots of fifteen minutes, so every slot ends later than before.
        await changeSchedule(eventId, scheduleOf(4, { slotMinutes: 15, breakMinutes: 0, totalMinutes: 60 }), draft => {
            draft.slotPlacing = {
                removeEveryone: false,
                chosen: { [movedRegistration.id]: at(45).getTime(), [guest.id]: at(0).getTime() },
            }
        })

        const newSlots = await slotsOf(variant.id)
        expect(newSlots.map(slot => slot.start)).toEqual([at(0), at(15), at(30), at(45)])
        expect(await holderOf(newSlots[3].id)).toBe(moved)
        expect(await holderOf(newSlots[1].id)).toBe(followed)
        expect((await prisma.eventRegistration.findUniqueOrThrow({ where: { id: guest.id } })).slotId).toBe(newSlots[0].id)
        expect(await registrationOf(waiting, variant.id)).toMatchObject({ state: 'IN_QUOTA', slotId: newSlots[2].id })
        await expectSlotsInStep(variant.id)

        notifiedWith(moved, `Du har nå tidsluken ${displaySlot(newSlots[3])} på Ny timeplan.`)
        notifiedWith(followed, `Du har nå tidsluken ${displaySlot(newSlots[1])} på Ny timeplan.`)
        notifiedWith(waiting, `Du har fått tidsluken ${displaySlot(newSlots[2])}.`)
        expect(notifiedUsers().sort()).toEqual([moved, followed, waiting].sort())
        expect(sentMail).toHaveBeenCalledTimes(1)
        expect(sentMail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'slot-admin-guest@example.com',
            html: expect.stringContaining(`Du har nå tidsluken ${displaySlot(newSlots[0])} på Ny timeplan.`),
        }))
    })

    test('is saved though a notice of it fails, and the other notices are still sent', async () => {
        const { eventId, variant, slots } = await createSlottedEvent('Varsel feiler')
        const [first, second, third, waiting] = userIds
        await register(eventId, first, slots[0].id)
        await register(eventId, second, slots[1].id)
        await register(eventId, third, slots[2].id)
        await prisma.eventRegistration.create({
            data: { state: 'WAITING_LIST', waitingListVariantId: variant.id, userId: waiting },
        })
        notifySpy.mockReset()
        // The promotion is told first and fails, as the channel of a notice may.
        notifySpy.mockRejectedValueOnce(new Error('Varselet kunne ikke lages'))
        notifySpy.mockResolvedValue({ notification: null })

        await changeSchedule(eventId, scheduleOf(4, { slotMinutes: 15, breakMinutes: 0, totalMinutes: 60 }))

        expect((await slotsOf(variant.id)).map(slot => slot.start)).toEqual([at(0), at(15), at(30), at(45)])
        expect(await registrationOf(waiting, variant.id)).toMatchObject({ state: 'IN_QUOTA' })
        expect(notifiedUsers().sort()).toEqual([first, second, third, waiting].sort())
    })

    test('refuses a placing on the waiting list of one the save seats in another variant', async () => {
        const event = await eventOperations.create({
            data: {
                kind: 'ORDINARY',
                name: 'To varianter',
                location: 'Lophtet',
                ...time,
                visibilityAdminRequirements: [{ conditions: [] }],
            },
            bypassAuth: true,
        })
        await eventOperations.saveSetup({
            params: { id: event.id },
            data: {
                waitingList: true,
                allowRegistrationInMultipleVariants: true,
                variants: [
                    {
                        name: 'Tidsluker',
                        registrationType: 'SLOTTED',
                        ...period,
                        slotSchedule: scheduleOf(2),
                        quotas: [{ name: 'Alle', places: 2, visibilityRequirements: open }],
                    },
                    { name: 'Liste', ...period, quotas: [{ name: 'Alle', places: 0, visibilityRequirements: open }] },
                ],
            },
            bypassAuth: true,
        })
        const [slotted, list] = await prisma.eventVariant.findMany({
            where: { eventId: event.id },
            orderBy: { order: 'asc' },
            include: { slots: { orderBy: { start: 'asc' } } },
        })
        const [moved, kept] = userIds
        await eventRegistrationOperations.createAsAdmin({
            params: { eventId: event.id, userId: moved, variantId: slotted.id, slotId: slotted.slots[0].id },
            bypassAuth: true,
        })
        await eventRegistrationOperations.createAsAdmin({
            params: { eventId: event.id, userId: kept, variantId: slotted.id, slotId: slotted.slots[1].id },
            bypassAuth: true,
        })
        await eventRegistrationOperations.createAsAdmin({
            params: { eventId: event.id, userId: moved, variantId: list.id },
            bypassAuth: true,
        })
        const movedRegistration = await registrationOf(moved, slotted.id)

        const [slottedDraft, listDraft] = await draftsOf(event.id)
        const shorter = withPlacesOfSlots({ ...slottedDraft, slotSchedule: scheduleOf(1) })
        shorter.slotPlacing = { removeEveryone: false, chosen: { [movedRegistration.id]: null } }
        listDraft.quotas[0].places = 1
        await expect(eventOperations.saveSetup({
            params: { id: event.id },
            data: { allowRegistrationInMultipleVariants: false, variants: variantsToPost([shorter, listDraft]) },
            bypassAuth: true,
        })).rejects.toMatchObject(refusedWith(
            'Noen som er plassert, fikk plass i en annen variant og står ikke lenger her. Plasser dem på nytt.'
        ))
        expect(await slotsOf(slotted.id)).toHaveLength(2)
        expect(await registrationOf(moved, slotted.id)).toMatchObject({ slotId: slotted.slots[0].id })
    })

    test('tells one whose slots change in two variants once, of both, and a guest in one mail', async () => {
        const event = await eventOperations.create({
            data: {
                kind: 'ORDINARY',
                name: 'Begge endres',
                location: 'Lophtet',
                ...time,
                visibilityAdminRequirements: [{ conditions: [] }],
            },
            bypassAuth: true,
        })
        const slottedVariant = (name: string) => ({
            name,
            registrationType: 'SLOTTED' as const,
            ...period,
            slotSchedule: scheduleOf(2),
            quotas: [{ name: 'Alle', places: 2, visibilityRequirements: open }],
        })
        await eventOperations.saveSetup({
            params: { id: event.id },
            data: {
                waitingList: true,
                allowRegistrationInMultipleVariants: true,
                variants: [slottedVariant('Runde 1'), slottedVariant('Runde 2')],
            },
            bypassAuth: true,
        })
        const variants = await prisma.eventVariant.findMany({
            where: { eventId: event.id },
            orderBy: { order: 'asc' },
            include: { slots: { orderBy: { start: 'asc' } } },
        })
        const [user] = userIds
        for (const variant of variants) {
            await eventRegistrationOperations.createAsAdmin({
                params: { eventId: event.id, userId: user, variantId: variant.id, slotId: variant.slots[0].id },
                bypassAuth: true,
            })
            const guest = await eventRegistrationOperations.createGuest({
                params: { eventId: event.id, variantId: variant.id, slotId: variant.slots[1].id },
                data: { name: 'Gjest', note: '' },
                bypassAuth: true,
            })
            await prisma.contactDetails.update({
                where: { id: guest.contactId! },
                data: { email: 'slot-admin-both@example.com' },
            })
        }

        const longer = scheduleOf(2, { slotMinutes: 15, breakMinutes: 0, totalMinutes: 30 })
        const drafts = (await draftsOf(event.id)).map(draft => withPlacesOfSlots({ ...draft, slotSchedule: longer }))
        await eventOperations.saveSetup({
            params: { id: event.id },
            data: { variants: variantsToPost(drafts) },
            bypassAuth: true,
        })

        expect(notifiedUsers()).toEqual([user])
        const [newFirst] = await slotsOf(variants[0].id)
        const [newSecond] = await slotsOf(variants[1].id)
        notifiedWith(user, `Du har nå tidsluken ${displaySlot(newFirst)} på Begge endres, Runde 1.`)
        notifiedWith(user, `Du har nå tidsluken ${displaySlot(newSecond)} på Begge endres, Runde 2.`)
        expect(sentMail).toHaveBeenCalledTimes(1)
        expect(sentMail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'slot-admin-both@example.com',
            html: expect.stringMatching(/Runde 1\.[^]*Runde 2\./),
        }))
    })

    test('refuses to send one who has paid to the waiting list, and saves nothing', async () => {
        const { eventId, variant, slots } = await createSlottedEvent('Betalt plass')
        const [paid, second, third] = userIds
        await register(eventId, paid, slots[0].id)
        await register(eventId, second, slots[1].id)
        await register(eventId, third, slots[2].id)
        const paidRegistration = await prisma.eventRegistration.update({
            where: { id: (await registrationOf(paid, variant.id)).id },
            data: { manuallyPaid: true },
        })

        await expect(changeSchedule(eventId, scheduleOf(2), draft => {
            draft.slotPlacing = { removeEveryone: false, chosen: { [paidRegistration.id]: null } }
        })).rejects.toMatchObject(refusedWith(
            'Noen som har betalt for plassen sin, er satt på ventelisten. Gi dem en tidsluke, eller meld dem av, '
            + 'så de får pengene tilbake.'
        ))
        expect(await slotsOf(variant.id)).toHaveLength(3)
        expect(await registrationOf(paid, variant.id)).toMatchObject({ state: 'IN_QUOTA', slotId: slots[0].id })
        // The board says who has paid, so that the form can say it before the save.
        const board = await eventSlotOperations.readBoard({ params: { variantId: variant.id }, bypassAuth: true })
        expect(board.slots.map(slot => slot.holder?.paid)).toEqual([true, false, false])
    })

    test('sends to the waiting list those a shorter schedule has no slot for, first in the queue', async () => {
        const { eventId, variant, slots } = await createSlottedEvent('Kortere timeplan')
        const [first, second, third, later] = userIds
        await register(eventId, first, slots[0].id)
        await register(eventId, second, slots[1].id)
        await register(eventId, third, slots[2].id)
        await prisma.eventRegistration.create({
            data: { state: 'WAITING_LIST', waitingListVariantId: variant.id, userId: later },
        })
        const table = await prisma.eventTable.create({ data: { eventId, order: 0, seats: 4 } })
        const firstRegistration = await prisma.eventRegistration.update({
            where: { id: (await registrationOf(first, variant.id)).id },
            data: { tableId: table.id, seat: 0, promotedAt: new Date() },
        })

        await changeSchedule(eventId, scheduleOf(2), draft => {
            draft.slotPlacing = { removeEveryone: false, chosen: { [firstRegistration.id]: null } }
        })

        const newSlots = await slotsOf(variant.id)
        expect(newSlots).toHaveLength(2)
        expect(await registrationOf(first, variant.id)).toMatchObject({
            state: 'WAITING_LIST',
            slotId: null,
            queuedAt: firstRegistration.queuedAt,
            promotedAt: null,
            tableId: null,
            seat: null,
        })
        expect(await holderOf(newSlots[1].id)).toBe(second)
        expect(await holderOf(newSlots[0].id)).toBe(third)
        expect((await prisma.eventQuota.findFirstOrThrow({ where: { variantId: variant.id } })).places).toBe(2)
        await expectSlotsInStep(variant.id)
        notifiedWith(first, 'Du har ikke lenger en tidsluke på Kortere timeplan, og står på ventelisten.')
        notifiedWith(third, `Du har nå tidsluken ${displaySlot(newSlots[0])} på Kortere timeplan.`)
        expect(notifiedUsers().sort()).toEqual([first, third].sort())

        notifySpy.mockClear()
        await eventRegistrationOperations.destroyAsAdmin({
            params: { registrationId: (await registrationOf(second, variant.id)).id },
            bypassAuth: true,
        })
        expect(await holderOf(newSlots[1].id)).toBe(first)
        expect(await registrationOf(later, variant.id)).toMatchObject({ state: 'WAITING_LIST' })
    })

    test('removes everyone registered, those waiting too, and tells them', async () => {
        const { eventId, variant, slots } = await createSlottedEvent('Alle meldes av', [
            { places: 2, visibilityRequirements: open },
        ])
        await register(eventId, userIds[0], slots[0].id)
        await registerGuest(eventId, slots[1].id, 'slot-admin-removed@example.com')
        await register(eventId, userIds[1])

        await changeSchedule(eventId, scheduleOf(3), draft => {
            draft.slotPlacing = { removeEveryone: true, chosen: {} }
        })

        expect(await prisma.eventRegistration.count({
            where: { OR: [{ quota: { variantId: variant.id } }, { waitingListVariantId: variant.id }] },
        })).toBe(0)
        expect(await slotsOf(variant.id)).toHaveLength(3)
        await expectSlotsInStep(variant.id)
        expect(notifySpy).toHaveBeenCalledTimes(1)
        expect(notifySpy).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                audience: { userIds: [userIds[0], userIds[1]] },
                message: 'Du er meldt av Alle meldes av, siden timeplanen er endret.',
            }),
        }))
        expect(sentMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'slot-admin-removed@example.com' }))
    })

    test('removes no one who registered after the removal was confirmed', async () => {
        const { eventId, variant, slots } = await createSlottedEvent('Meldt av før de kom')
        const [early, late] = userIds
        await register(eventId, early, slots[0].id)
        const [confirmed] = await draftsOf(eventId)
        await register(eventId, late, slots[1].id)

        const removingEveryone = withPlacesOfSlots({ ...confirmed, slotSchedule: scheduleOf(2) })
        removingEveryone.slotPlacing = { removeEveryone: true, chosen: {} }
        await expect(eventOperations.saveSetup({
            params: { id: eventId },
            data: { variants: variantsToPost([removingEveryone]) },
            bypassAuth: true,
        })).rejects.toMatchObject(refusedWith(
            'Påmeldingene er endret siden skjemaet ble åpnet. Åpne det på nytt, og se hvem som meldes av.'
        ))
        expect(await holderOf(slots[1].id)).toBe(late)
        expect(await holderOf(slots[0].id)).toBe(early)

        const [current] = await draftsOf(eventId)
        const now = withPlacesOfSlots({ ...current, slotSchedule: scheduleOf(2) })
        now.slotPlacing = { removeEveryone: true, chosen: {} }
        await eventOperations.saveSetup({
            params: { id: eventId },
            data: { variants: variantsToPost([now]) },
            bypassAuth: true,
        })
        expect(await prisma.eventRegistration.count({
            where: { OR: [{ quota: { variantId: variant.id } }, { waitingListVariantId: variant.id }] },
        })).toBe(0)
    })

    test('refuses a placing made before someone came or left, or that puts two in one slot or one in none', async () => {
        const { eventId, variant, slots } = await createSlottedEvent('Feil plassering')
        const other = await createSlottedEvent('Annen plassering')
        const registrations = [
            await register(eventId, userIds[0], slots[0].id),
            await register(eventId, userIds[1], slots[1].id),
            await register(other.eventId, userIds[2], other.slots[0].id),
        ]
        // Two slots, of twelve minutes from the start and from seventeen minutes past.
        const schedule = scheduleOf(3, { slotMinutes: 12 })
        const placed = (starts: (Date | null)[], ids = [0, 1, 2]) => ({
            removeEveryone: false as const,
            placements: starts.map((slotStart, index) => ({ registrationId: registrations[ids[index]].id, slotStart })),
        })
        const changedSince = 'Påmeldingene er endret siden skjemaet ble åpnet. Åpne det på nytt, og plasser dem igjen.'

        for (const [slotPlacing, refusal] of [
            [placed([at(0)]), changedSince],
            [placed([at(0), at(17), null]), changedSince],
            [placed([at(0), at(17)], [0, 0]), 'Noen er plassert to ganger.'],
            [placed([at(0), at(0)]), 'To er plassert i samme tidsluke.'],
            [placed([at(0), at(5)]), 'Noen er plassert i en tidsluke som ikke finnes.'],
            [placed([at(0), null]), 'Noen er satt på ventelisten, men har en ledig plass i en tidsluke. Plasser dem der.'],
            [null, 'Noen har tidsluker som ikke finnes i den nye timeplanen. Plasser dem i de nye tidslukene, '
                + 'eller meld av alle.'],
        ] as const) {
            await expect(postPlacing(eventId, schedule, slotPlacing)).rejects.toMatchObject(refusedWith(refusal))
            expect(await slotsOf(variant.id)).toEqual(slots)
            expect(await holderOf(slots[0].id)).toBe(userIds[0])
            expect(await holderOf(slots[1].id)).toBe(userIds[1])
            expect((await prisma.eventSlotSchedule.findUniqueOrThrow({ where: { variantId: variant.id } })).slotMinutes)
                .toBe(10)
        }
        expect(notifySpy).not.toHaveBeenCalled()
    })

    test('refuses a placing the places of the quotas do not hold, and saves nothing', async () => {
        const some = await groupOf('slotadminsome', [userIds[0], userIds[1]])
        const others = await groupOf('slotadminothers', [userIds[2]])
        const { eventId, variant, slots } = await createSlottedEvent('Kvotene rekker ikke', [
            { places: 2, visibilityRequirements: some },
            { places: 2, visibilityRequirements: others },
        ])
        for (let index = 0; index < 3; index++) await registerAsAdmin(eventId, userIds[index], slots[index].id)

        await expect(changeSchedule(eventId, scheduleOf(3), draft => {
            draft.quotas[0].places = 1
            draft.quotas[1].places = 2
        })).rejects.toMatchObject(refusedWith(
            'Kvotene har ikke plass til alle slik de er plassert. Endre plassene i kvotene, eller plasser dem på nytt.'
        ))
        expect(await slotsOf(variant.id)).toEqual(slots)
        expect(await holderOf(slots[1].id)).toBe(userIds[1])
        expect(notifySpy).not.toHaveBeenCalled()
    })

    test('leaves one waiting beside a slot that the quotas let no one waiting take', async () => {
        const members = await groupOf('slotadminwait', [userIds[0]])
        const { eventId, variant, quotas, slots } = await createSlottedEvent('Venter ved ledig tidsluke', [
            { places: 1, visibilityRequirements: members },
            { places: 1, visibilityRequirements: open },
        ])
        await registerAsAdmin(eventId, userIds[0], slots[0].id)
        const outside = await registerAsAdmin(eventId, userIds[1], slots[1].id)

        await changeSchedule(eventId, scheduleOf(2, { start: at(5) }), draft => {
            draft.quotas[0].places = 2
            draft.quotas[1].places = 0
            draft.slotPlacing = { removeEveryone: false, chosen: { [outside.id]: null } }
        })

        const newSlots = await slotsOf(variant.id)
        expect(await holderOf(newSlots[0].id)).toBe(userIds[0])
        expect(await holderOf(newSlots[1].id)).toBeNull()
        expect(await registrationOf(userIds[1], variant.id)).toMatchObject({ state: 'WAITING_LIST', slotId: null })
        expect((await prisma.eventQuota.findUniqueOrThrow({ where: { id: quotas[0].id } })).places).toBe(2)
        await expectSlotsInStep(variant.id)
    })

    test('gives slots only to those with a place in the variant', async () => {
        const { variant, slots } = await createSlottedEvent('Bare egne')
        const other = await createSlottedEvent('Andres')
        const elsewhere = await register(other.eventId, userIds[0], other.slots[0].id)

        await expect(prisma.$transaction(tx => eventRegistrationOperations.internal.takeSlots.internalCall({
            prisma: tx,
            params: { variantId: variant.id },
            data: { placements: [{ registrationId: elsewhere.id, slotId: slots[0].id }] },
        }))).rejects.toMatchObject(refusedWith('Påmeldingen har ikke plass i varianten.'))
        expect(await holderOf(other.slots[0].id)).toBe(userIds[0])
    })

    test('tells those whose slot changed of the change to the event with their slot, and the rest apart', async () => {
        const { eventId, variant, slots } = await createSlottedEvent('Endret & varslet')
        const [kept, moved, waiting] = userIds
        await register(eventId, kept, slots[0].id)
        await register(eventId, moved, slots[1].id)
        await registerGuest(eventId, slots[2].id, 'slot-admin-told@example.com')
        await register(eventId, waiting)

        // The first slot stays as it was, and the others start later.
        await changeSchedule(eventId, scheduleOf(3, { breakMinutes: 10, totalMinutes: 50 }), () => {}, true)

        const newSlots = await slotsOf(variant.id)
        expect(await holderOf(newSlots[0].id)).toBe(kept)
        expect(await holderOf(newSlots[1].id)).toBe(moved)
        expect(notifySpy).toHaveBeenCalledTimes(2)
        expect(notifySpy).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                audience: { userIds: [moved] },
                message: expect.stringMatching(
                    new RegExp(`^Endret & varslet er endret\\..* Du har nå tidsluken ${displaySlot(newSlots[1])}`)
                ),
            }),
        }))
        expect(notifySpy).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                audience: { userIds: expect.arrayContaining([kept, waiting]), registeredForEventId: eventId },
                message: expect.stringMatching(/^Endret & varslet er endret\./),
            }),
        }))
        expect(notifiedUsers().sort()).toEqual([kept, moved, waiting].sort())
        expect(sentMail).toHaveBeenCalledTimes(1)
        expect(sentMail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'slot-admin-told@example.com',
            html: expect.stringContaining('Endret &amp; varslet er endret.'),
        }))
        expect(sentMail).toHaveBeenCalledWith(expect.objectContaining({
            html: expect.stringContaining(`Du har nå tidsluken ${displaySlot(newSlots[2])} på Endret &amp; varslet.`),
        }))
    })
})

describe('an administrator moving someone to another slot', () => {
    test('moves a user and a guest to a free slot after registration has closed, and tells each', async () => {
        const { eventId, variant, slots } = await createSlottedEvent('Flyttes av arrangør', [
            { places: 4, visibilityRequirements: open },
        ])
        const user = await register(eventId, userIds[0], slots[0].id)
        const guest = await registerGuest(eventId, slots[1].id, 'slot-admin-moved@example.com')
        await prisma.eventVariant.update({
            where: { id: variant.id },
            data: { registrationEnd: new Date(Date.now() - MINUTE) },
        })

        await moveAsAdmin(user.id, slots[3].id)
        await moveAsAdmin(guest.id, slots[2].id)

        expect(await holderOf(slots[3].id)).toBe(userIds[0])
        expect((await prisma.eventRegistration.findUniqueOrThrow({ where: { id: guest.id } })).slotId).toBe(slots[2].id)
        await expectSlotsInStep(variant.id)
        notifiedWith(userIds[0], `Du har nå tidsluken ${displaySlot(slots[3])} på Flyttes av arrangør.`)
        expect(notifySpy).toHaveBeenCalledTimes(1)
        expect(sentMail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'slot-admin-moved@example.com',
            html: expect.stringContaining(`Du har nå tidsluken ${displaySlot(slots[2])}`),
        }))
    })

    test('names the variant in the notice when the event has several', async () => {
        const event = await eventOperations.create({
            data: {
                kind: 'ORDINARY',
                name: 'To varianter',
                location: 'Lophtet',
                ...time,
                visibilityAdminRequirements: [{ conditions: [] }],
            },
            bypassAuth: true,
        })
        await eventOperations.saveSetup({
            params: { id: event.id },
            data: {
                variants: [
                    {
                        name: 'Morgen',
                        registrationType: 'SLOTTED',
                        ...period,
                        slotSchedule: scheduleOf(2),
                        quotas: [{ name: 'Alle', places: 2, visibilityRequirements: open }],
                    },
                    { name: 'Kveld', ...period, quotas: [{ name: 'Alle', places: 2, visibilityRequirements: open }] },
                ],
            },
            bypassAuth: true,
        })
        const variant = await prisma.eventVariant.findFirstOrThrow({
            where: { eventId: event.id, name: 'Morgen' },
            include: { slots: { orderBy: { start: 'asc' } } },
        })
        const registration = await eventRegistrationOperations.createAsAdmin({
            params: { eventId: event.id, userId: userIds[0], variantId: variant.id, slotId: variant.slots[0].id },
            bypassAuth: true,
        })

        await moveAsAdmin(registration.id, variant.slots[1].id)

        notifiedWith(userIds[0], `Du har nå tidsluken ${displaySlot(variant.slots[1])} på To varianter, Morgen.`)
    })

    test('refuses a taken slot, a slot of another variant and a registration on a list variant', async () => {
        const { eventId, slots } = await createSlottedEvent('Flytting nektes')
        const other = await createSlottedEvent('En annen variant')
        const first = await register(eventId, userIds[0], slots[0].id)
        await register(eventId, userIds[1], slots[1].id)
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
        const onList = await registerAsAdmin(list.id, userIds[0])

        await expect(moveAsAdmin(first.id, slots[1].id))
            .rejects.toMatchObject(refusedWith('Tidsluken er tatt. Velg en annen.'))
        await expect(moveAsAdmin(first.id, other.slots[0].id))
            .rejects.toMatchObject(refusedWith('Tidsluken hører ikke til varianten.'))
        await expect(moveAsAdmin(onList.id, slots[2].id))
            .rejects.toMatchObject(refusedWith('Påmeldingen har ingen tidsluke å bytte.'))
        expect(await holderOf(slots[0].id)).toBe(userIds[0])
        expect(notifySpy).not.toHaveBeenCalled()
    })

    test('is refused, and the board too, to one who does not administrate the event, the registrant too', async () => {
        const { eventId, variant, slots } = await createSlottedEvent('Ikke arrangør')
        const registration = await register(eventId, userIds[0], slots[0].id)
        const user = await prisma.user.findUniqueOrThrow({ where: { id: userIds[0] } })
        // Published and open to all, so the registrant sees it and is refused only for not administrating it.
        await prisma.event.update({ where: { id: eventId }, data: { published: true, canBeViewedBy: 'ALL' } })

        await expect(eventRegistrationOperations.moveToSlotAsAdmin({
            params: { registrationId: registration.id },
            data: { slotId: slots[1].id },
            session: testSession({ user: user as never }),
        })).rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
        await expect(eventSlotOperations.readBoard({
            params: { variantId: variant.id },
            session: testSession({ user: user as never }),
        })).rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
        expect(await holderOf(slots[0].id)).toBe(userIds[0])
    })
})

describe('at the same instant', () => {
    test('an administrator moving someone into a slot a user picks gets it, or is told it is taken', async () => {
        const { eventId, variant, slots } = await createSlottedEvent('Flytting mot påmelding', [
            { places: 3, visibilityRequirements: open },
        ])
        const moved = await register(eventId, userIds[0], slots[0].id)
        const picking = userIds[1]

        for (let round = 0; round < 20; round++) {
            const free = await prisma.eventSlot.findFirstOrThrow({
                where: { variantId: variant.id, registration: null },
                orderBy: { start: round % 2 === 0 ? 'asc' : 'desc' },
            })
            const lead = (round % 5) * 3
            const attempts = await Promise.allSettled([
                after(round % 2 === 0 ? lead : 0, () => moveAsAdmin(moved.id, free.id)),
                after(round % 2 === 0 ? 0 : lead, () => register(eventId, picking, free.id)),
            ])

            expect(attempts.filter(attempt => attempt.status === 'fulfilled')).toHaveLength(1)
            expect(attempts.flatMap(attempt => (attempt.status === 'rejected' ? [attempt.reason as unknown] : [])))
                .toEqual([expect.objectContaining(refusedWith('Tidsluken er tatt. Velg en annen.'))])
            await expectSlotsInStep(variant.id)
            const picked = await prisma.eventRegistration.findFirst({
                where: { userId: picking, quota: { variantId: variant.id } },
            })
            if (picked) {
                await eventRegistrationOperations.destroyAsAdmin({ params: { registrationId: picked.id }, bypassAuth: true })
            }
        }
    })

    test('a schedule change and a pick of a slot it replaces: one goes through, and the other is refused', async () => {
        const { eventId, variant, slots } = await createSlottedEvent('Ny timeplan mot påmelding')
        await register(eventId, userIds[0], slots[0].id)
        const picking = userIds[1]

        for (let round = 0; round < 12; round++) {
            const [free] = await prisma.eventSlot.findMany({
                where: { variantId: variant.id, registration: null },
                orderBy: { start: 'desc' },
            })
            const [draft] = await draftsOf(eventId)
            const schedule = scheduleOf(3, { slotMinutes: draft.slotSchedule?.slotMinutes === 10 ? 12 : 10 })
            const [posted] = variantsToPost([withPlacesOfSlots({ ...draft, slotSchedule: schedule })])
            const lead = (round % 4) * 4
            const [change, pick] = await Promise.allSettled([
                after(round % 2 === 0 ? lead : 0, () => eventOperations.saveSetup({
                    params: { id: eventId },
                    data: { variants: [posted] },
                    bypassAuth: true,
                })),
                after(round % 2 === 0 ? 0 : lead, () => register(eventId, picking, free.id)),
            ])

            if (change.status === 'fulfilled') {
                expect(pick).toMatchObject({
                    status: 'rejected',
                    reason: refusedWith('Tidsluken hører ikke til varianten.'),
                })
            } else {
                expect(change.reason).toMatchObject(refusedWith(
                    'Påmeldingene er endret siden skjemaet ble åpnet. Åpne det på nytt, og plasser dem igjen.'
                ))
                expect(pick.status).toBe('fulfilled')
            }
            await expectSlotsInStep(variant.id)
            const picked = await prisma.eventRegistration.findFirst({
                where: { userId: picking, quota: { variantId: variant.id } },
            })
            if (picked) {
                await eventRegistrationOperations.destroyAsAdmin({ params: { registrationId: picked.id }, bypassAuth: true })
            }
        }
    })
})
