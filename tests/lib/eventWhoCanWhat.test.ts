import { whoCanWhat } from '@/services/events/whoCanWhat'
import { describe, expect, test } from '@jest/globals'
import type { EventAccess } from '@/services/events/types'
import type { VisibilityCondition, VisibilityMatrix } from '@/services/visibility/types'

const group = (groupId: number): VisibilityCondition => ({ type: 'ACTIVE', groupId })
const inGroups = (...requirements: number[][]): VisibilityMatrix => ({
    requirements: requirements.map(ids => ({ conditions: ids.map(group) })),
})
const everyone: VisibilityMatrix = { requirements: [] }
const ARRKOM = 1
const MEMBERS = 2
const THIRD = 3
const FOURTH = 4

const event = (changes: Partial<EventAccess>): EventAccess => ({
    published: true,
    canBeViewedBy: 'ALL',
    adminVisibility: inGroups([ARRKOM]),
    creatorId: 7,
    quotaVisibilities: [everyone],
    ...changes,
})
const rowOf = (access: EventAccess, label: 'loggedOut' | 'loggedIn' | 'eventAdmin') => (
    whoCanWhat(access).find(row => row.label === label)
)
const rowsFor = (access: EventAccess, groupId: number) => whoCanWhat(access).filter(row => (
    row.audience?.requirements.some(requirement => requirement.conditions.some(condition => condition.groupId === groupId))
))

describe('whoCanWhat', () => {
    test('an open event is seen by all, and logging in is what it takes to register', () => {
        expect(rowOf(event({}), 'loggedOut')).toMatchObject({ sees: true, registers: 'login', administers: false })
        expect(rowOf(event({}), 'loggedIn')).toMatchObject({ sees: true, registers: 'yes', administers: false })
    })

    test('EVENT_ADMIN administrates whatever the event says', () => {
        expect(rowOf(event({ published: false }), 'eventAdmin')).toMatchObject({ sees: true, administers: true })
    })

    test('administrators get a row of their own', () => {
        const [arrkom] = rowsFor(event({}), ARRKOM)
        expect(arrkom).toMatchObject({ sees: true, administers: true })
    })

    test('a draft is hidden from all but those administrating it', () => {
        const draft = event({ published: false })
        expect(rowOf(draft, 'loggedOut')).toMatchObject({ sees: false, registers: 'no' })
        expect(rowOf(draft, 'loggedIn')).toMatchObject({ sees: false, registers: 'no' })
        expect(rowsFor(draft, ARRKOM)[0]).toMatchObject({ sees: true })
    })

    test('an event only for those who can register is hidden from the rest', () => {
        const access = event({ canBeViewedBy: 'CAN_REGISTER', quotaVisibilities: [inGroups([MEMBERS])] })
        expect(rowOf(access, 'loggedOut')?.sees).toBe(false)
        expect(rowOf(access, 'loggedIn')).toMatchObject({ sees: false, registers: 'no' })
        expect(rowsFor(access, MEMBERS)[0]).toMatchObject({ sees: true, registers: 'yes' })
    })

    test('having to be in two groups is one row that gets in', () => {
        const access = event({ quotaVisibilities: [inGroups([MEMBERS], [THIRD])] })
        const rows = rowsFor(access, MEMBERS)
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({ registers: 'yes' })
    })

    test('being in either of two groups is a row for each', () => {
        const rows = rowsFor(event({ quotaVisibilities: [inGroups([THIRD, FOURTH])] }), THIRD)
        expect(rows).toHaveLength(1)
        expect(rowsFor(event({ quotaVisibilities: [inGroups([THIRD, FOURTH])] }), FOURTH)[0].registers).toBe('yes')
    })

    test('someone wanted by two quotas is one row', () => {
        const access = event({ quotaVisibilities: [inGroups([MEMBERS]), inGroups([MEMBERS])] })
        expect(rowsFor(access, MEMBERS)).toHaveLength(1)
    })

    test('nobody registers without a quota', () => {
        expect(rowOf(event({ quotaVisibilities: [] }), 'loggedOut')?.registers).toBe('no')
        expect(rowOf(event({ quotaVisibilities: [] }), 'loggedIn')?.registers).toBe('no')
    })

    test('no one is an administrator through requirements without conditions', () => {
        const access = event({ adminVisibility: { requirements: [{ conditions: [] }] } })
        expect(rowOf(access, 'loggedIn')?.administers).toBe(false)
        expect(rowOf(access, 'eventAdmin')?.administers).toBe(true)
    })
})
