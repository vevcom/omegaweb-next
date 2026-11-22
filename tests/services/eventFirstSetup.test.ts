import { prisma } from '@/prisma-pn-client-instance'
import { eventOperations } from '@/services/events/operations'
import { firstRegistrationPeriod, firstVariantSetup } from '@/services/events/firstSetup'
import { eventSetupFromForm, firstVariantDraft, variantsToPost } from '@/services/events/setupDraft'
import { slotsOrProblem } from '@/services/events/slots/schedule'
import { describe, expect, test } from '@jest/globals'
import type { Data } from '@/services/serviceOperation'
import type { EventKind } from '@/prisma-generated-pn-types'

const DAY = 24 * 60 * 60 * 1000
const visibilityAdminRequirements = [{ conditions: [] }]

// 16:15 in Oslo, which is UTC+1 in winter and UTC+2 in summer.
const winter = { eventStart: new Date('2027-01-20T15:15:00Z'), eventEnd: new Date('2027-01-20T17:00:00Z') }
const summer = { eventStart: new Date('2027-06-10T14:15:00Z'), eventEnd: new Date('2027-06-10T16:00:00Z') }
const contactorsKinds: EventKind[] = ['COMPANY_PRESENTATION', 'SPEED_INTERVIEW']

const periodOf = (registrationStart: string, registrationEnd: string) => ({
    registrationStart: new Date(registrationStart),
    registrationEnd: new Date(registrationEnd),
})

const variantsOf = (eventId: number) => prisma.eventVariant.findMany({ where: { eventId }, orderBy: { order: 'asc' } })

const create = (kind: EventKind, data: Partial<Data<typeof eventOperations.create>> = {}) => (
    eventOperations.create({
        data: { kind, name: `Første oppsett ${kind}`, visibilityAdminRequirements, ...data },
        bypassAuth: true,
    })
)

describe('the registration period a kind gives', () => {
    test.each(contactorsKinds)('opens a week before the day of %s at 12:00 and closes that day at 12:00, in Oslo', kind => {
        expect(firstRegistrationPeriod(kind, winter))
            .toEqual(periodOf('2027-01-13T11:00:00Z', '2027-01-20T11:00:00Z'))
        expect(firstRegistrationPeriod(kind, summer))
            .toEqual(periodOf('2027-06-03T10:00:00Z', '2027-06-10T10:00:00Z'))
    })

    test('is reckoned on the days of Oslo, also on and across the days the clock is changed', () => {
        const at1615 = (day: string, offset: 1 | 2) => ({
            eventStart: new Date(`${day}T${16 - offset}:15:00Z`),
            eventEnd: new Date(`${day}T${18 - offset}:00:00Z`),
        })
        expect(firstRegistrationPeriod('COMPANY_PRESENTATION', at1615('2027-04-01', 2)))
            .toEqual(periodOf('2027-03-25T11:00:00Z', '2027-04-01T10:00:00Z'))
        expect(firstRegistrationPeriod('COMPANY_PRESENTATION', at1615('2027-03-28', 2)))
            .toEqual(periodOf('2027-03-21T11:00:00Z', '2027-03-28T10:00:00Z'))
        expect(firstRegistrationPeriod('COMPANY_PRESENTATION', at1615('2027-11-04', 1)))
            .toEqual(periodOf('2027-10-28T10:00:00Z', '2027-11-04T11:00:00Z'))
        expect(firstRegistrationPeriod('COMPANY_PRESENTATION', at1615('2027-10-31', 1)))
            .toEqual(periodOf('2027-10-24T10:00:00Z', '2027-10-31T11:00:00Z'))

        // Still the 19th in UTC.
        const pastMidnight = { eventStart: new Date('2027-01-19T23:30:00Z'), eventEnd: new Date('2027-01-20T01:00:00Z') }
        expect(firstRegistrationPeriod('COMPANY_PRESENTATION', pastMidnight)?.registrationStart)
            .toEqual(new Date('2027-01-13T11:00:00Z'))
    })

    test('closes when the event starts, for one that starts before 12:00', () => {
        // 09:00 in Oslo.
        const morning = { eventStart: new Date('2027-01-20T08:00:00Z'), eventEnd: new Date('2027-01-20T10:00:00Z') }
        expect(firstRegistrationPeriod('SPEED_INTERVIEW', morning))
            .toEqual(periodOf('2027-01-13T11:00:00Z', '2027-01-20T08:00:00Z'))
    })

    test('is none for an ordinary event, and none while an event has no time', () => {
        expect(firstRegistrationPeriod('ORDINARY', winter)).toBeNull()
        expect(firstRegistrationPeriod('COMPANY_PRESENTATION', {
            eventStart: winter.eventStart,
            eventEnd: winter.eventStart,
        })).toBeNull()
        expect(firstRegistrationPeriod('COMPANY_PRESENTATION', {
            eventStart: new Date(''),
            eventEnd: winter.eventEnd,
        })).toBeNull()
    })
})

describe('an event created with a start', () => {
    test.each(contactorsKinds)('of the kind %s has binding registration and the period of its kind', async kind => {
        const event = await create(kind, { ...summer, takesRegistration: true })

        expect(event.bindingRegistration).toBe(true)
        expect(await variantsOf(event.id)).toMatchObject([periodOf('2027-06-03T10:00:00Z', '2027-06-10T10:00:00Z')])
    })

    test('ordinary has neither, as before', async () => {
        const before = Date.now()
        const event = await create('ORDINARY', { ...summer, takesRegistration: true })
        const after = Date.now()

        expect(event.bindingRegistration).toBe(false)
        const [variant] = await variantsOf(event.id)
        expect(variant.registrationStart.getTime()).toBeGreaterThanOrEqual(before)
        expect(variant.registrationStart.getTime()).toBeLessThanOrEqual(after)
        expect(variant.registrationEnd.getTime()).toBeGreaterThanOrEqual(before + DAY)
        expect(variant.registrationEnd.getTime()).toBeLessThanOrEqual(after + DAY)
    })

    test('keeps the binding and the period it is given', async () => {
        const given = periodOf('2027-06-01T08:00:00Z', '2027-06-09T20:00:00Z')
        const event = await create('COMPANY_PRESENTATION', {
            ...summer,
            takesRegistration: true,
            bindingRegistration: false,
            ...given,
        })

        expect(event.bindingRegistration).toBe(false)
        expect(await variantsOf(event.id)).toMatchObject([given])
    })
})

describe('a draft created without a start', () => {
    test('has binding registration, and no period of its kind while it has no time', async () => {
        const draft = await create('COMPANY_PRESENTATION')

        expect(draft.bindingRegistration).toBe(true)
        expect(await variantsOf(draft.id)).toEqual([])
        expect(firstRegistrationPeriod(draft.kind, draft)).toBeNull()
    })

    test('that takes registration gets the period any event gets', async () => {
        const before = Date.now()
        const draft = await create('COMPANY_PRESENTATION', { takesRegistration: true })
        const after = Date.now()

        const [variant] = await variantsOf(draft.id)
        expect(variant.registrationStart.getTime()).toBeGreaterThanOrEqual(before)
        expect(variant.registrationEnd.getTime()).toBeLessThanOrEqual(after + DAY)
    })

    test('keeps the period of its kind through a save, on a first variant drafted once a start is set', async () => {
        const draft = await create('SPEED_INTERVIEW')
        const values = new FormData()
        values.set('eventStart', '2027-01-20T15:15')
        values.set('eventEnd', '2027-01-20T17:00')
        const time = eventSetupFromForm(values, {
            ...draft,
            adminVisibility: { requirements: [] },
            ledgerAccount: null,
            companyPresentation: null,
        })

        const first = firstVariantDraft('Påmelding', draft.eventStart, firstVariantSetup(draft.kind, time))
        await eventOperations.saveSetup({
            params: { id: draft.id },
            data: { eventStart: time.eventStart, eventEnd: time.eventEnd, variants: variantsToPost([first]) },
            bypassAuth: true,
        })

        expect(await variantsOf(draft.id)).toMatchObject([periodOf('2027-01-13T11:00:00Z', '2027-01-20T11:00:00Z')])
    })

    test('gets the period any event gets on a first variant the setup form makes while it has no time', async () => {
        const draft = await create('SPEED_INTERVIEW')

        const first = firstVariantDraft('Påmelding', draft.eventStart, firstVariantSetup(draft.kind, draft))
        expect(first.registrationEnd).toEqual(draft.eventStart)
    })
})

describe('the registration type of the first variant', () => {
    const typeOfKind = [
        ['ORDINARY', 'LIST'],
        ['COMPANY_PRESENTATION', 'LIST'],
        ['SPEED_INTERVIEW', 'SLOTTED'],
    ] as const

    test.each(typeOfKind)('of an event of the kind %s created with registration is %s', async (kind, registrationType) => {
        const event = await create(kind, { ...winter, takesRegistration: true })

        expect(await variantsOf(event.id)).toMatchObject([{ registrationType }])
    })

    test.each(typeOfKind)('of an event of the kind %s set up in the form is %s', async (kind, registrationType) => {
        const draft = await create(kind)

        const first = firstVariantDraft('Påmelding', draft.eventStart, firstVariantSetup(draft.kind, winter))
        await eventOperations.saveSetup({
            params: { id: draft.id },
            data: { ...winter, variants: variantsToPost([first]) },
            bypassAuth: true,
        })

        expect(await variantsOf(draft.id)).toMatchObject([{ registrationType }])
    })

    test('of a speed interview set up in the form has slots from the start set, and a place for each', async () => {
        const draft = await create('SPEED_INTERVIEW')

        const first = firstVariantDraft('Påmelding', draft.eventStart, firstVariantSetup(draft.kind, winter))
        await eventOperations.saveSetup({
            params: { id: draft.id },
            data: { ...winter, variants: variantsToPost([first]) },
            bypassAuth: true,
        })

        const ofDraft = { variant: { eventId: draft.id } }
        const slots = await prisma.eventSlot.findMany({ where: ofDraft, orderBy: { start: 'asc' } })
        expect(slots).toHaveLength(8)
        expect(slots[0].start).toEqual(winter.eventStart)
        expect(await prisma.eventQuota.findMany({ where: ofDraft })).toMatchObject([{ places: 8 }])
    })
})

describe('the schedule of a slotted first variant of a draft without a time', () => {
    test('has no start in the setup form, which asks for one, and gets the start once a time is set', async () => {
        const draft = await create('SPEED_INTERVIEW')

        const first = firstVariantDraft('Påmelding', draft.eventStart, firstVariantSetup(draft.kind, draft))
        expect(first.slotSchedule?.start).toBeNull()
        expect(first.slotSchedule && slotsOrProblem(first.slotSchedule).problem)
            .toBe('Sett når den første tidsluken starter.')
        expect(firstVariantSetup(draft.kind, winter).slotSchedule?.start).toEqual(winter.eventStart)
    })

    test('is not made at creation, which refuses registration until the event has a time', async () => {
        await expect(create('SPEED_INTERVIEW', { takesRegistration: true })).rejects.toMatchObject({
            errors: [{ message: 'Sett når arrangementet er før det tar påmelding, så tidslukene kan legges etter det.' }],
        })
    })
})

describe('what an administrator has chosen', () => {
    test('is kept through later saves, which never give the defaults again', async () => {
        const event = await create('COMPANY_PRESENTATION', { ...winter, takesRegistration: true })
        const [variant] = await variantsOf(event.id)
        const chosen = periodOf('2027-01-15T07:00:00Z', '2027-01-19T22:00:00Z')
        const save = (data: Data<typeof eventOperations.saveSetup>) => eventOperations.saveSetup({
            params: { id: event.id },
            data,
            bypassAuth: true,
        })

        await save({
            bindingRegistration: false,
            variants: [{ id: variant.id, name: variant.name, ...chosen, takesPayment: false, quotas: [] }],
        })
        const moved = await save({
            eventStart: new Date('2027-01-27T15:15:00Z'),
            eventEnd: new Date('2027-01-27T17:00:00Z'),
        })

        expect(moved.bindingRegistration).toBe(false)
        expect(await variantsOf(event.id)).toMatchObject([chosen])
    })
})
