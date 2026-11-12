import { eventSetupChecks, hasNoTime, publishProblems, setupStatuses } from '@/services/events/publishProblems'
import { describe, expect, test } from '@jest/globals'

const HOUR = 60 * 60 * 1000
const at = (hours: number) => new Date(Date.UTC(2026, 10, 10) + hours * HOUR)

const variant = {
    name: 'Påmelding',
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
    adminVisibility: { requirements: [{ conditions: [{ type: 'ACTIVE' as const, groupId: 1 }] }] },
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
