import { describeMemberships, describeVisibility, visibilityWarnings } from '@/components/Visibility/describeVisibility'
import { describe, expect, test } from '@jest/globals'
import type { ExpandedGroup } from '@/services/groups/types'
import type { VisibilityCondition } from '@/services/visibility/types'

const groups = [
    { id: 1, name: '1. klasse', groupType: 'CLASS', order: 108 },
    { id: 2, name: '2. klasse', groupType: 'CLASS', order: 108 },
    { id: 3, name: 'Medlemmer', groupType: 'OMEGA_MEMBERSHIP_GROUP', order: 108 },
    { id: 4, name: 'Sysken', groupType: 'OMEGA_MEMBERSHIP_GROUP', order: 108 },
    { id: 5, name: 'Styret', groupType: 'COMMITTEE', order: 108 },
    { id: 6, name: 'Kybernetikk', groupType: 'STUDY_PROGRAMME', order: 108 },
] as ExpandedGroup[]

function condition(groupId: number, order: number | null, onlyActive = false, onlyAdmins = false): VisibilityCondition {
    return { groupId, order, onlyActive, onlyAdmins }
}
const active = (groupId: number) => condition(groupId, null, true)

describe('describeVisibility', () => {
    test('calls everyone what it is told to, for a rule that asks more than the visibility', () => {
        expect(describeVisibility({ requirements: [] }, groups, { everyone: 'Alle som er logget inn' }))
            .toBe('Alle som er logget inn')
    })

    test('no requirements let everyone in', () => {
        expect(describeVisibility({ requirements: [] }, groups)).toBe('Alle')
    })

    test('names the groups of one requirement as alternatives', () => {
        expect(describeVisibility({ requirements: [{ conditions: [active(1), active(2)] }] }, groups))
            .toBe('1. klasse (aktive) eller 2. klasse (aktive)')
    })

    test('joins several requirements, since all of them must pass', () => {
        expect(describeVisibility({
            requirements: [{ conditions: [active(3)] }, { conditions: [active(1)] }],
        }, groups)).toBe('Medlemmer (aktive) som også er i 1. klasse (aktive)')
    })

    test('says of each group which of its memberships are meant', () => {
        expect(describeVisibility({ requirements: [{ conditions: [condition(5, 107, true), active(2)] }] }, groups))
            .toBe('Styret (107. orden, aktive) eller 2. klasse (aktive)')
    })

    test('a list without groups lets no one in', () => {
        expect(describeVisibility({ requirements: [{ conditions: [active(3)] }, { conditions: [] }] }, groups)).toBe('Ingen')
    })

    test('falls back to the id of a group it does not know', () => {
        expect(describeVisibility({ requirements: [{ conditions: [active(9)] }] }, null)).toBe('gruppe #9 (aktive)')
    })

    test('uses commas until the last group', () => {
        expect(describeVisibility({ requirements: [{ conditions: [active(1), active(2), active(3)] }] }, groups))
            .toBe('1. klasse (aktive), 2. klasse (aktive) eller Medlemmer (aktive)')
    })
})

describe('describeMemberships', () => {
    test.each([
        [null, false, false, 'alle ordener'],
        [null, true, false, 'aktive'],
        [null, false, true, 'alle ordener, administratorer'],
        [null, true, true, 'aktive administratorer'],
        [108, false, false, '108. orden'],
        [107, true, false, '107. orden, aktive'],
        [108, false, true, '108. orden, administratorer'],
        [108, true, true, '108. orden, aktive administratorer'],
    ] as const)('order %s, only active %s, only admins %s: "%s"', (order, onlyActive, onlyAdmins, words) => {
        expect(describeMemberships(condition(5, order, onlyActive, onlyAdmins))).toBe(words)
    })
})

describe('visibilityWarnings', () => {
    const warningsOf = (...lists: VisibilityCondition[][]) => visibilityWarnings(
        { requirements: lists.map(conditions => ({ conditions })) },
        groups,
    )
    const classes = 'Ingen går i to klasser samtidig. Skal begge klassene med, legg dem i samme liste.'
    const memberships = 'Ingen har to medlemskap i Omega samtidig. Skal begge med, legg dem i samme liste.'

    test('two lists of only active classes cannot both pass', () => {
        expect(warningsOf([active(1)], [active(2)])).toEqual([classes])
    })

    test('classes in one list are a choice between them', () => {
        expect(warningsOf([active(1), active(2)])).toEqual([])
    })

    test('lists of classes that share one can all pass', () => {
        expect(warningsOf([active(1), active(2)], [active(2)])).toEqual([])
        expect(warningsOf([active(1), active(2)], [active(1), active(2)])).toEqual([])
        expect(warningsOf([active(1), active(2)], [active(2)], [active(1)])).toEqual([classes])
    })

    test('a list with something other than classes can pass', () => {
        expect(warningsOf([active(1)], [active(3)])).toEqual([])
        expect(warningsOf([active(1), active(3)], [active(2)])).toEqual([])
    })

    test('lists of classes of one and the same order cannot both pass, of two orders they can', () => {
        expect(warningsOf([condition(1, 108)], [condition(2, 108)])).toEqual([classes])
        expect(warningsOf([condition(1, 108)], [condition(2, 107)])).toEqual([])
    })

    test('a class of an earlier year can go with the one someone is in now', () => {
        expect(warningsOf([condition(1, 104)], [active(2)])).toEqual([])
    })

    test('two lists of only active omega membership groups cannot both pass, of one order they can', () => {
        expect(warningsOf([active(3)], [active(4)])).toEqual([memberships])
        expect(warningsOf([condition(3, 108)], [condition(4, 108)])).toEqual([])
    })

    test('a group migrated by hand has no active members of another order than its own', () => {
        expect(warningsOf([condition(5, 107, true)])).toEqual([
            'Ingen i Styret er aktive i 107. orden, siden bare de i gruppens nåværende orden, 108., er aktive. '
            + 'Velg 108. orden eller ta bort «Bare aktive».',
        ])
        expect(warningsOf([condition(5, 108, true)])).toEqual([])
        expect(warningsOf([condition(5, 107)])).toEqual([])
        expect(warningsOf([condition(5, null, true)])).toEqual([])
    })

    test('says a warning once, however many conditions give it', () => {
        expect(warningsOf([condition(5, 107, true)], [condition(5, 107, true, true)])).toHaveLength(1)
        expect(warningsOf([active(1)], [active(2)], [condition(1, 108)], [condition(2, 108)])).toHaveLength(1)
    })

    test('a group that follows Omega keeps active members of the order they got them in', () => {
        expect(warningsOf([condition(6, 104, true)])).toEqual([])
        expect(warningsOf([condition(1, 104, true)])).toEqual([])
    })
})
