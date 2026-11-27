import { eventSetupChecks, hasNoTime, publishProblems, setupStatuses } from '@/services/events/publishProblems'
import { defaultSlotSchedule } from '@/services/events/slots/schedule'
import { activeMembersOf } from 'tests/utils'
import { describe, expect, test } from '@jest/globals'
import type { EventSetup } from '@/services/events/publishProblems'

const HOUR = 60 * 60 * 1000
const at = (hours: number) => new Date(Date.UTC(2026, 10, 10) + hours * HOUR)

const variant = {
    name: 'Påmelding',
    registrationType: 'LIST' as const,
    slotSchedule: null,
    registrationStart: at(0),
    registrationEnd: at(10),
    takesPayment: false,
    quotas: [{ places: 10 }],
}
const paying = { ...variant, takesPayment: true, price: 100, paymentStart: at(0), paymentEnd: at(20) }
const ready = {
    location: 'Lophtet',
    eventStart: at(24),
    eventEnd: at(26),
    canBeViewedBy: 'ALL' as const,
    ledgerAccount: { id: 1 },
    variants: [variant],
    adminVisibility: { requirements: [{ conditions: [activeMembersOf(1)] }] },
}

// How a form with a tab for the rules and one for the rest might show the parts.
const tabOfPart = {
    time: 'about',
    location: 'about',
    visibility: 'rules',
    registration: 'registration',
    payment: 'payment',
    administrators: 'access',
} as const

const statuses = (event: typeof ready | Parameters<typeof eventSetupChecks>[0]) => (
    setupStatuses(eventSetupChecks(event), tabOfPart)
)

describe('eventSetupChecks', () => {
    test('a finished event has every group clear', () => {
        expect(eventSetupChecks({ ...ready, variants: [paying] })).toEqual([])
        expect(Object.values(statuses(ready)).map(status => status.level)).toEqual(Array(5).fill('ok'))
    })

    test('says which part of the event each check is about, and the groups follow', () => {
        const partsOf = (event: Parameters<typeof eventSetupChecks>[0]) => eventSetupChecks(event).map(check => check.part)
        expect(partsOf({ ...ready, location: ' ', eventEnd: ready.eventStart })).toEqual(['time', 'location'])
        expect(partsOf({ ...ready, canBeViewedBy: 'CAN_REGISTER', variants: [] })).toEqual(['visibility'])
        // A date the form has emptied is asked for, and not compared with the others.
        expect(eventSetupChecks({ ...ready, variants: [{ ...variant, registrationEnd: null }] })).toEqual([
            { part: 'registration', level: 'missing', message: 'Påmeldingsperioden må settes.' },
        ])

        expect(statuses({ ...ready, location: ' ' }).about.level).toBe('missing')
        expect(statuses({ ...ready, adminVisibility: { requirements: [{ conditions: [] }] } }).access.level).toBe('missing')
        expect(statuses({ ...ready, variants: [paying], ledgerAccount: null }).payment.level).toBe('missing')
        expect(statuses({ ...ready, canBeViewedBy: 'CAN_REGISTER', variants: [] }).rules.level).toBe('missing')
    })

    test('warns of what is allowed without stopping publishing', () => {
        const event = { ...ready, eventStart: at(5), eventEnd: at(6), variants: [{ ...variant, quotas: [{ places: 0 }] }] }
        expect(statuses(event).registration.level).toBe('warning')
        expect(publishProblems(event)).toEqual([])
    })

    test('one missing thing outweighs the warnings of a group', () => {
        const backwards = { ...variant, registrationStart: at(11), quotas: [{ places: 0 }] }
        const status = statuses({ ...ready, variants: [backwards] }).registration
        expect(status.level).toBe('missing')
        expect(status.label).toContain('Ingen plasser')
    })

    test('names the variant when there are several', () => {
        const [check] = eventSetupChecks({
            ...ready,
            variants: [{ ...paying, price: 0, name: 'VIP' }, variant],
        })
        expect(check.message).toBe('VIP: Prisen mangler.')
    })

    test('a date that cannot be read is not reported as out of order', () => {
        expect(() => eventSetupChecks({ ...ready, eventStart: new Date('') })).not.toThrow()
    })

    test('an event that starts and ends at the same instant has no time, and is asked for one', () => {
        expect(hasNoTime({ eventStart: at(24), eventEnd: at(24) })).toBe(true)
        expect(hasNoTime(ready)).toBe(false)
        expect(statuses({ ...ready, eventEnd: ready.eventStart }).about.level).toBe('missing')
        expect(statuses({ ...ready, eventStart: at(30) }).about.level).toBe('missing')
    })
})

describe('eventSetupChecks of a slotted variant', () => {
    // Eight slots from the start of the event, the last ending an hour and fifty-five minutes in.
    const slotted = {
        ...variant,
        registrationType: 'SLOTTED' as const,
        slotSchedule: { ...defaultSlotSchedule(ready.eventStart), totalMinutes: 115 },
        quotas: [{ places: 8 }],
    }
    const eventWith = (changes: Partial<EventSetup['variants'][number]>) => ({
        ...ready,
        variants: [{ ...slotted, ...changes }],
    })
    const scheduleWith = (changes: Partial<typeof slotted.slotSchedule>) => ({ ...slotted.slotSchedule, ...changes })

    test('finds nothing when its places are its slots and the slots are within the event', () => {
        expect(eventSetupChecks(eventWith({}))).toEqual([])
        expect(eventSetupChecks(eventWith({ quotas: [{ places: 5 }, { places: 3 }] }))).toEqual([])
    })

    test('asks for a schedule, and for one that gives slots', () => {
        expect(eventSetupChecks(eventWith({ slotSchedule: null }))).toEqual([
            { part: 'registration', level: 'missing', message: 'Tidslukene mangler en timeplan.' },
        ])
        expect(publishProblems(eventWith({ slotSchedule: scheduleWith({ slotMinutes: 2 }) })))
            .toEqual(['En tidsluke må vare fra 3 til 120 minutter.'])
    })

    test('asks for as many places as there are slots, whatever the quotas', () => {
        const problem = 'Kvotene har 7 plasser til sammen, men det er 8 tidsluker.'
        expect(publishProblems(eventWith({ quotas: [{ places: 7 }] }))).toEqual([problem])
        expect(publishProblems(eventWith({ quotas: [{ places: 4 }, { places: 3 }] }))).toEqual([problem])
    })

    test('does not say no places are set, which the slots set', () => {
        expect(eventSetupChecks(eventWith({ quotas: [{ places: 0 }] })).map(check => check.message))
            .toEqual(['Kvotene har 0 plasser til sammen, men det er 8 tidsluker.'])
    })

    test('asks for slots within the time of the event, the end of the last one included', () => {
        const outside = 'Tidslukene ligger utenfor tiden arrangementet varer.'
        // Five slots of 25 minutes, the last from 1:40 to 2:05 into an event of two hours.
        const late = eventWith({
            quotas: [{ places: 5 }],
            slotSchedule: scheduleWith({ slotMinutes: 25, breakMinutes: 0, totalMinutes: 125 }),
        })
        expect(publishProblems(late)).toEqual([outside])
        expect(publishProblems(eventWith({ slotSchedule: scheduleWith({ start: at(23) }) }))).toEqual([outside])
        const filling = eventWith({
            quotas: [{ places: 4 }],
            slotSchedule: scheduleWith({ slotMinutes: 30, breakMinutes: 0, totalMinutes: 120 }),
        })
        expect(publishProblems(filling)).toEqual([])
        // The schedule starts on the whole minute the event starts within.
        expect(publishProblems({ ...eventWith({}), eventStart: new Date(ready.eventStart.getTime() + 17_456) })).toEqual([])
    })

    test('leaves the slots alone while the event has no time, which is asked for instead', () => {
        expect(eventSetupChecks({ ...eventWith({}), eventEnd: ready.eventStart }))
            .toEqual([{ part: 'time', level: 'missing', message: 'Sett når arrangementet starter og slutter.' }])
    })

    test('asks for the start of a schedule made while the event had no time', () => {
        expect(publishProblems(eventWith({ slotSchedule: defaultSlotSchedule(null) })))
            .toEqual(['Sett når den første tidsluken starter.'])
    })

    test('names the variant when there are several', () => {
        expect(publishProblems({ ...ready, variants: [variant, { ...slotted, name: 'Intervju', slotSchedule: null }] }))
            .toEqual(['Intervju: Tidslukene mangler en timeplan.'])
    })
})
