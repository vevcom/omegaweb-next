import { pickedGroupIds, withPickedGroups } from '@/components/Visibility/pickedGroups'
import { describe, expect, test } from '@jest/globals'
import type { ExpandedGroup } from '@/services/groups/types'

// The revue group is an order behind the rest, as a group that migrates on its own is.
const groups = [
    { id: 1, name: 'Styret', groupType: 'COMMITTEE', order: 108 },
    { id: 2, name: 'Revystyret', groupType: 'COMMITTEE', order: 106 },
] as ExpandedGroup[]

describe('a picked group', () => {
    test('starts as its active members where the owner says so', () => {
        expect(withPickedGroups([], [2], groups, 'ACTIVE')).toEqual([{ type: 'ACTIVE', groupId: 2 }])
    })

    test('starts at its own newest order where the owner says so, which need not be that of the others', () => {
        expect(withPickedGroups([], [1, 2], groups, 'NEWEST_ORDER')).toEqual([
            { type: 'ORDER', groupId: 1, order: 108 },
            { type: 'ORDER', groupId: 2, order: 106 },
        ])
    })

    test('changed to the other kind is offered again, and picking it again keeps both', () => {
        const changed = [{ type: 'ACTIVE' as const, groupId: 2 }]
        expect(pickedGroupIds(changed, groups, 'NEWEST_ORDER')).toEqual([])
        expect(withPickedGroups(changed, [2], groups, 'NEWEST_ORDER')).toEqual([
            { type: 'ACTIVE', groupId: 2 },
            { type: 'ORDER', groupId: 2, order: 106 },
        ])
    })

    test('taken out again loses what the pick put there, and nothing else of that group or of the others', () => {
        const others = [
            { type: 'ORDER' as const, groupId: 1, order: 108 },
            { type: 'ORDER' as const, groupId: 2, order: 105 },
            { type: 'ACTIVE' as const, groupId: 2 },
        ]
        const picked = { type: 'ORDER' as const, groupId: 2, order: 106 }
        expect(pickedGroupIds([...others, picked], groups, 'NEWEST_ORDER')).toEqual([1, 2])
        expect(withPickedGroups([...others, picked], [1], groups, 'NEWEST_ORDER')).toEqual(others)
    })

    test('at an earlier order is kept when the other groups are picked', () => {
        const earlier = { type: 'ORDER' as const, groupId: 2, order: 105 }
        expect(withPickedGroups([earlier], [1], groups, 'NEWEST_ORDER')).toEqual([
            earlier,
            { type: 'ORDER', groupId: 1, order: 108 },
        ])
    })
})
