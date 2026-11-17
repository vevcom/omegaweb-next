import { describeVisibility, listsContradict } from '@/auth/visibility/describeVisibility'
import { describe, expect, test } from '@jest/globals'
import type { ExpandedGroup } from '@/services/groups/types'

const groups = [
    { id: 1, name: '1. klasse', groupType: 'CLASS' },
    { id: 2, name: '2. klasse', groupType: 'CLASS' },
    { id: 3, name: 'Medlemmer', groupType: 'OMEGA_MEMBERSHIP_GROUP' },
] as ExpandedGroup[]

const active = (groupId: number) => ({ type: 'ACTIVE' as const, groupId })

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
            .toBe('1. klasse eller 2. klasse')
    })

    test('joins several requirements, since all of them must pass', () => {
        expect(describeVisibility({
            requirements: [{ conditions: [active(3)] }, { conditions: [active(1)] }],
        }, groups)).toBe('Medlemmer som også er i 1. klasse')
    })

    test('a list without groups lets no one in', () => {
        expect(describeVisibility({ requirements: [{ conditions: [active(3)] }, { conditions: [] }] }, groups)).toBe('Ingen')
    })

    test('falls back to the id of a group it does not know', () => {
        expect(describeVisibility({ requirements: [{ conditions: [active(9)] }] }, null)).toBe('gruppe #9')
    })
})

describe('listing several groups', () => {
    test('uses commas until the last one', () => {
        expect(describeVisibility({ requirements: [{ conditions: [active(1), active(2), active(3)] }] }, groups))
            .toBe('1. klasse, 2. klasse eller Medlemmer')
    })
})

describe('listsContradict', () => {
    const contradicts = (...lists: number[][]) => listsContradict(
        { requirements: lists.map(ids => ({ conditions: ids.map(active) })) },
        groups,
    )

    test('two lists of only classes cannot both pass', () => {
        expect(contradicts([1], [2])).toBe(true)
    })

    test('classes in one list are a choice between them', () => {
        expect(contradicts([1, 2])).toBe(false)
    })

    test('lists of classes that share one can all pass', () => {
        expect(contradicts([1, 2], [2])).toBe(false)
        expect(contradicts([1, 2], [1, 2])).toBe(false)
        expect(contradicts([1, 2], [2], [1])).toBe(true)
    })

    test('a list with something other than classes can pass', () => {
        expect(contradicts([1], [3])).toBe(false)
        expect(contradicts([1, 3], [2])).toBe(false)
    })

    test('a class of an earlier year can go with the one someone is in now', () => {
        const earlier = { type: 'ORDER' as const, groupId: 1, order: 104 }
        const requirements = [{ conditions: [earlier] }, { conditions: [active(2)] }]
        expect(listsContradict({ requirements }, groups)).toBe(false)
    })
})
