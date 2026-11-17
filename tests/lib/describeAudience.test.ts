import { describeAudience } from '@/auth/visibility/describeVisibility'
import { describe, expect, test } from '@jest/globals'
import type { ExpandedGroup } from '@/services/groups/types'

const groups = [
    { id: 1, name: '1. klasse' },
    { id: 2, name: '2. klasse' },
    { id: 3, name: 'Medlemmer' },
] as ExpandedGroup[]

const active = (groupId: number) => ({ type: 'ACTIVE' as const, groupId })

describe('describeAudience', () => {
    test('no requirements let everyone in', () => {
        expect(describeAudience({ requirements: [] }, groups)).toBe('Alle')
    })

    test('names the groups of one requirement as alternatives', () => {
        expect(describeAudience({ requirements: [{ conditions: [active(1), active(2)] }] }, groups))
            .toBe('1. klasse eller 2. klasse')
    })

    test('joins several requirements, since all of them must pass', () => {
        expect(describeAudience({
            requirements: [{ conditions: [active(3)] }, { conditions: [active(1)] }],
        }, groups)).toBe('Medlemmer, som også er i 1. klasse')
    })

    test('falls back to the id of a group it does not know', () => {
        expect(describeAudience({ requirements: [{ conditions: [active(9)] }] }, null)).toBe('gruppe #9')
    })
})
