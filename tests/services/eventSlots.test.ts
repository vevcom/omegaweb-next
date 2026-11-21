import { changeEventSetup, createAdministrators } from 'tests/eventSetup'
import { withPlacesOfSlots } from '@/services/events/setupDraft'
import { defaultSlotSchedule } from '@/services/events/slots/schedule'
import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { userOperations } from '@/services/users/operations'
import { beforeAll, describe, expect, test } from '@jest/globals'
import type { VariantDraft } from '@/services/events/setupDraft'
import type { Data } from '@/services/serviceOperation'
import type { EventRegistrationType } from '@/prisma-generated-pn-types'
import type { VisibilityRequirement } from '@/services/visibility/types'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const open = { visibilityRequirements: [] }
const period = {
    registrationStart: new Date(Date.now() - HOUR),
    registrationEnd: new Date(Date.now() + 24 * HOUR),
    takesPayment: false,
}
const time = {
    eventStart: new Date(Math.floor(Date.now() / HOUR) * HOUR + 48 * HOUR),
    eventEnd: new Date(Math.floor(Date.now() / HOUR) * HOUR + 51 * HOUR),
}
// Eight slots of ten minutes, five apart, from the start of the event.
const schedule = { ...defaultSlotSchedule(time.eventStart), start: time.eventStart }

let userIds: number[]
let administrators: VisibilityRequirement[]

const refusedWith = (message: string) => ({ errors: [expect.objectContaining({ message })] })

beforeAll(async () => {
    const users = await Promise.all(['first', 'second'].map(name => userOperations.create({
        data: {
            email: `event-slots-${name}@omega.ntnu.no`,
            firstname: 'Test',
            lastname: 'Testesen',
            username: `event-slots-${name}`,
            emailVerified: new Date().toISOString(),
        },
        bypassAuth: true,
    })))
    userIds = users.map(user => user.id)
    administrators = await createAdministrators('event-slots')
})

const save = (id: number, data: Data<typeof eventOperations.saveSetup>) => eventOperations.saveSetup({
    params: { id },
    data,
    bypassAuth: true,
})

async function createEventWithVariant(name: string, registrationType: EventRegistrationType) {
    const event = await eventOperations.create({
        data: { kind: 'ORDINARY', name, location: 'Lophtet', ...time, visibilityAdminRequirements: administrators },
        bypassAuth: true,
    })
    await save(event.id, {
        waitingList: true,
        variants: [{
            name: 'Påmelding',
            registrationType,
            ...period,
            ...(registrationType === 'SLOTTED'
                ? { slotSchedule: schedule, quotas: [{ name: 'Alle', places: 8, ...open }] }
                : { quotas: [{ name: 'Alle', places: 2, ...open }] }),
        }],
    })
    const variant = await prisma.eventVariant.findFirstOrThrow({ where: { eventId: event.id } })
    return { eventId: event.id, variant }
}

/** Changes the variants as the form does, which gives a slotted variant with one quota a place for each slot. */
const changeAsTheForm = (eventId: number, change: (variants: VariantDraft[]) => void) => (
    changeEventSetup(eventId, variants => {
        change(variants)
        variants.splice(0, variants.length, ...variants.map(withPlacesOfSlots))
    })
)

const registerAsAdmin = (eventId: number, userId: number, slotId?: number) => (
    eventRegistrationOperations.createAsAdmin({ params: { eventId, userId, slotId }, bypassAuth: true })
)

const typeOf = async (variantId: number) => (
    await prisma.eventVariant.findUniqueOrThrow({ where: { id: variantId } })
).registrationType

const slotsOf = (variantId: number) => prisma.eventSlot.findMany({ where: { variantId }, orderBy: { start: 'asc' } })

const scheduleOf = (variantId: number) => prisma.eventSlotSchedule.findUnique({ where: { variantId } })

const placesOf = async (variantId: number) => (
    await prisma.eventQuota.findMany({ where: { variantId }, orderBy: { order: 'asc' } })
).map(quota => quota.places)

describe('the registration type of a variant', () => {
    test('is a list unless it is said otherwise', async () => {
        const event = await eventOperations.create({
            data: {
                kind: 'ORDINARY',
                name: 'Liste som før',
                takesRegistration: true,
                visibilityAdminRequirements: [{ conditions: [] }],
            },
            bypassAuth: true,
        })

        expect(await prisma.eventVariant.findMany({ where: { eventId: event.id } }))
            .toMatchObject([{ registrationType: 'LIST' }])
    })

    test('is kept through a save, and changed by one while no one is registered', async () => {
        const { eventId, variant } = await createEventWithVariant('Bytter type', 'SLOTTED')

        await changeAsTheForm(eventId, variants => {
            variants[0].name = 'Nytt navn'
        })
        expect(await typeOf(variant.id)).toBe('SLOTTED')

        await changeAsTheForm(eventId, variants => {
            variants[0].registrationType = 'LIST'
        })
        expect(await typeOf(variant.id)).toBe('LIST')
        expect(await scheduleOf(variant.id)).toBeNull()
        expect(await slotsOf(variant.id)).toEqual([])
    })

    test('is not changed while someone is registered', async () => {
        const { eventId, variant } = await createEventWithVariant('Har påmeldte', 'LIST')
        await registerAsAdmin(eventId, userIds[0])

        await expect(changeAsTheForm(eventId, variants => {
            variants[0].registrationType = 'SLOTTED'
            variants[0].slotSchedule = schedule
        })).rejects.toMatchObject(refusedWith('Varianten har påmeldte, så påmeldingstypen kan ikke endres.'))
        expect(await typeOf(variant.id)).toBe('LIST')
        expect(await slotsOf(variant.id)).toEqual([])
    })

    test('is not changed while someone waits for a place', async () => {
        const { eventId, variant } = await createEventWithVariant('Har en som venter', 'LIST')
        await prisma.eventRegistration.create({
            data: { state: 'WAITING_LIST', waitingListVariantId: variant.id, userId: userIds[1] },
        })

        await expect(changeEventSetup(eventId, variants => {
            variants[0].registrationType = 'SLOTTED'
            variants[0].slotSchedule = schedule
        })).rejects.toMatchObject(refusedWith('Varianten har påmeldte, så påmeldingstypen kan ikke endres.'))
        expect(await typeOf(variant.id)).toBe('LIST')
    })
})

describe('a slotted variant', () => {
    test('of a speed interview is created with a schedule from its start, its slots and a place for each', async () => {
        const event = await eventOperations.create({
            data: {
                kind: 'SPEED_INTERVIEW',
                name: 'Speedintervju med tidsluker',
                location: 'EL5',
                ...time,
                takesRegistration: true,
                visibilityAdminRequirements: await createAdministrators('slots-speed'),
            },
            bypassAuth: true,
        })
        const variant = await prisma.eventVariant.findFirstOrThrow({ where: { eventId: event.id } })

        expect(await scheduleOf(variant.id)).toMatchObject(schedule)
        expect((await slotsOf(variant.id)).map(slot => [slot.start, slot.end])).toEqual([0, 15, 30, 45, 60, 75, 90, 105].map(
            minutes => [minutes, minutes + 10].map(offset => new Date(time.eventStart.getTime() + offset * MINUTE))
        ))
        expect(await placesOf(variant.id)).toEqual([8])
        // Nothing is missing for publishing.
        await eventOperations.setPublished({ params: { id: event.id }, data: { published: true }, bypassAuth: true })
    })

    test('keeps its schedule and its slots through a save that does not change them', async () => {
        const { eventId, variant } = await createEventWithVariant('Lagres som før', 'SLOTTED')
        const slots = await slotsOf(variant.id)

        await changeAsTheForm(eventId, variants => {
            variants[0].name = 'Nytt navn'
        })

        expect(await scheduleOf(variant.id)).toMatchObject(schedule)
        expect(await slotsOf(variant.id)).toEqual(slots)
    })

    test('keeps its slot rows through a save of the same schedule, whatever the rule would make of it now', async () => {
        const { eventId, variant } = await createEventWithVariant('Laget etter en eldre regel', 'SLOTTED')
        const [first] = await slotsOf(variant.id)
        // As if the rule had made the first slot a minute longer when the schedule was saved.
        await prisma.eventSlot.update({ where: { id: first.id }, data: { end: new Date(first.end.getTime() + MINUTE) } })
        const [quota] = await prisma.eventQuota.findMany({ where: { variantId: variant.id } })
        await prisma.eventRegistration.create({ data: { state: 'IN_QUOTA', quotaId: quota.id, userId: userIds[0] } })
        const rows = await slotsOf(variant.id)

        await changeAsTheForm(eventId, variants => {
            variants[0].name = 'Nytt navn'
        })

        expect(await slotsOf(variant.id)).toEqual(rows)
    })

    test('has its slots replaced when its schedule changes them, and its places follow', async () => {
        const { eventId, variant } = await createEventWithVariant('Kortere timeplan', 'SLOTTED')
        const before = await slotsOf(variant.id)

        await changeAsTheForm(eventId, variants => {
            variants[0].slotSchedule = { ...schedule, totalMinutes: 60, longBreakEveryMinutes: 30, longBreakMinutes: 10 }
        })

        const after = await slotsOf(variant.id)
        expect(after.map(slot => (slot.start.getTime() - time.eventStart.getTime()) / MINUTE)).toEqual([0, 15, 30, 50])
        expect(after.some(slot => before.some(old => old.id === slot.id))).toBe(false)
        expect(await scheduleOf(variant.id)).toMatchObject({ totalMinutes: 60, longBreakEveryMinutes: 30 })
        expect(await placesOf(variant.id)).toEqual([4])
    })

    test('keeps its slots when a change to its schedule leaves them as they are', async () => {
        const { eventId, variant } = await createEventWithVariant('Litt lengre', 'SLOTTED')
        const slots = await slotsOf(variant.id)

        await changeAsTheForm(eventId, variants => {
            variants[0].slotSchedule = { ...schedule, totalMinutes: 119 }
        })

        expect(await scheduleOf(variant.id)).toMatchObject({ totalMinutes: 119 })
        expect(await slotsOf(variant.id)).toEqual(slots)
    })

    test('is refused a change to its slots while someone is registered, and saves nothing', async () => {
        const { eventId, variant } = await createEventWithVariant('Har en i en tidsluke', 'SLOTTED')
        const slots = await slotsOf(variant.id)
        await registerAsAdmin(eventId, userIds[0], slots[0].id)

        await expect(changeAsTheForm(eventId, variants => {
            variants[0].name = 'Skal ikke lagres'
            variants[0].slotSchedule = { ...schedule, slotMinutes: 15 }
        })).rejects.toMatchObject(refusedWith('Varianten har påmeldte, så tidslukene kan ikke endres. Meld dem av først.'))
        expect(await slotsOf(variant.id)).toEqual(slots)
        expect(await scheduleOf(variant.id)).toMatchObject(schedule)
        expect((await prisma.eventVariant.findUniqueOrThrow({ where: { id: variant.id } })).name).toBe('Påmelding')

        await changeAsTheForm(eventId, variants => {
            variants[0].name = 'Lagres med timeplanen som den er'
        })
        await changeAsTheForm(eventId, variants => {
            variants[0].slotSchedule = { ...schedule, totalMinutes: 119 }
        })
        expect(await slotsOf(variant.id)).toEqual(slots)
    })

    test('is refused a change to its slots while someone waits for a place', async () => {
        const { eventId, variant } = await createEventWithVariant('Har en som venter på en tidsluke', 'SLOTTED')
        await prisma.eventRegistration.create({
            data: { state: 'WAITING_LIST', waitingListVariantId: variant.id, userId: userIds[1] },
        })
        const slots = await slotsOf(variant.id)

        await expect(changeAsTheForm(eventId, variants => {
            variants[0].slotSchedule = { ...schedule, slotMinutes: 15 }
        })).rejects.toMatchObject(refusedWith('Varianten har påmeldte, så tidslukene kan ikke endres. Meld dem av først.'))
        expect(await slotsOf(variant.id)).toEqual(slots)
    })

    test('has the start of its schedule cut to the whole minute, saved or made at creation', async () => {
        const { eventId, variant } = await createEventWithVariant('Hele minutter', 'SLOTTED')
        const withSeconds = new Date(time.eventStart.getTime() + 17_456)

        await changeAsTheForm(eventId, variants => {
            variants[0].slotSchedule = { ...schedule, start: withSeconds }
        })
        expect(await scheduleOf(variant.id)).toMatchObject({ start: time.eventStart })
        expect((await slotsOf(variant.id))[0].start).toEqual(time.eventStart)

        const created = await eventOperations.create({
            data: {
                kind: 'SPEED_INTERVIEW',
                name: 'Starter med sekunder',
                eventStart: withSeconds,
                eventEnd: time.eventEnd,
                takesRegistration: true,
                visibilityAdminRequirements: administrators,
            },
            bypassAuth: true,
        })
        const { id: createdVariantId } = await prisma.eventVariant.findFirstOrThrow({ where: { eventId: created.id } })
        expect(await scheduleOf(createdVariantId)).toMatchObject({ start: time.eventStart })
    })

    test('is not published with slots outside the time of the event', async () => {
        const { eventId } = await createEventWithVariant('Tidsluker dagen før', 'SLOTTED')
        const publish = () => eventOperations.setPublished({
            params: { id: eventId },
            data: { published: true },
            bypassAuth: true,
        })
        await changeAsTheForm(eventId, variants => {
            variants[0].slotSchedule = { ...schedule, start: new Date(time.eventStart.getTime() - 24 * HOUR) }
        })

        await expect(publish()).rejects.toMatchObject(refusedWith('Tidslukene ligger utenfor tiden arrangementet varer.'))
        await changeAsTheForm(eventId, variants => {
            variants[0].slotSchedule = schedule
        })
        await publish()
    })

    test('is refused places that are not its slots, however they are shared out', async () => {
        const { eventId, variant } = await createEventWithVariant('Feil antall plasser', 'SLOTTED')
        const refused = refusedWith('Kvotene har 7 plasser til sammen, men det er 8 tidsluker. De må være like mange.')

        await expect(changeEventSetup(eventId, variants => {
            variants[0].quotas[0].places = 7
        })).rejects.toMatchObject(refused)
        await expect(changeEventSetup(eventId, variants => {
            variants[0].quotas = [{ ...variants[0].quotas[0], places: 4 }, { key: -1, name: 'Andre', places: 3,
                visibilityRequirements: [], numOfRegistrations: 0 }]
        })).rejects.toMatchObject(refused)
        expect(await placesOf(variant.id)).toEqual([8])

        await changeEventSetup(eventId, variants => {
            variants[0].quotas = [{ ...variants[0].quotas[0], places: 5 }, { key: -1, name: 'Andre', places: 3,
                visibilityRequirements: [], numOfRegistrations: 0 }]
        })
        expect(await placesOf(variant.id)).toEqual([5, 3])
    })

    test('needs a schedule, which only a slotted variant has, within its limits', async () => {
        const { eventId } = await createEventWithVariant('Uten timeplan', 'LIST')
        const variant = { name: 'Påmelding', ...period, quotas: [{ name: 'Alle', places: 8, ...open }] }

        await expect(save(eventId, { variants: [{ ...variant, registrationType: 'SLOTTED' }] }))
            .rejects.toMatchObject(refusedWith('En variant med tidsluker må ha en timeplan.'))
        await expect(save(eventId, { variants: [{ ...variant, registrationType: 'LIST', slotSchedule: schedule }] }))
            .rejects.toMatchObject(refusedWith('Bare en variant med tidsluker har en timeplan.'))
        await expect(save(eventId, {
            variants: [{ ...variant, registrationType: 'SLOTTED', slotSchedule: { ...schedule, slotMinutes: 121 } }],
        })).rejects.toMatchObject({
            errorCode: 'BAD DATA',
            parseError: { error: { issues: [expect.objectContaining({
                path: ['variants', 0, 'slotSchedule'],
                message: 'En tidsluke må vare fra 3 til 120 minutter.',
            })] } },
        })
    })

    test('takes its schedule and slots with it when it is removed', async () => {
        const { eventId, variant } = await createEventWithVariant('Fjernes', 'SLOTTED')

        await save(eventId, { variants: [] })

        expect(await scheduleOf(variant.id)).toBeNull()
        expect(await slotsOf(variant.id)).toEqual([])
    })
})

describe('a list variant', () => {
    test('has no schedule and no slots, created or saved', async () => {
        const { eventId, variant } = await createEventWithVariant('Bare en liste', 'LIST')
        await changeAsTheForm(eventId, variants => {
            variants[0].quotas[0].places = 5
        })

        expect(await scheduleOf(variant.id)).toBeNull()
        expect(await slotsOf(variant.id)).toEqual([])
        expect(await placesOf(variant.id)).toEqual([5])
    })
})
