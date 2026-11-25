import { pickedGroupIds, withPickedGroups } from '@/components/Visibility/pickedGroups'
import { describe, expect, test } from '@jest/globals'
import type { DefaultMembershipRequirement } from '@/components/Visibility/pickedGroups'
import type { ExpandedGroup } from '@/services/groups/types'
import type { VisibilityCondition } from '@/services/visibility/types'

// The revue group is an order behind the rest, as a group that migrates on its own is.
const groups = [
    { id: 1, name: 'Styret', groupType: 'COMMITTEE', order: 108 },
    { id: 2, name: 'Revystyret', groupType: 'COMMITTEE', order: 106 },
] as ExpandedGroup[]

const regular: DefaultMembershipRequirement = { order: 'CURRENT_GROUP_ORDER', onlyActive: false }
const admin: DefaultMembershipRequirement = { order: null, onlyActive: true }

function condition(groupId: number, order: number | null, onlyActive = false, onlyAdmins = false): VisibilityCondition {
    return { groupId, order, onlyActive, onlyAdmins }
}

describe('a picked group', () => {
    test('starts as the active members of any order where the owner says so', () => {
        expect(withPickedGroups([], [2], groups, admin)).toEqual([condition(2, null, true)])
    })

    test('starts at its own current order where the owner says so, which need not be that of the others', () => {
        expect(withPickedGroups([], [1, 2], groups, regular)).toEqual([condition(1, 108), condition(2, 106)])
    })

    test('starts at the order the owner names, and never as only the admins', () => {
        expect(withPickedGroups([], [1], groups, { order: 100, onlyActive: true })).toEqual([condition(1, 100, true)])
    })

    test('changed into another form is offered again, and picking it again keeps both', () => {
        const changed = [condition(2, 106, false, true)]
        expect(pickedGroupIds(changed, groups, regular)).toEqual([])
        expect(withPickedGroups(changed, [2], groups, regular)).toEqual([...changed, condition(2, 106)])
    })

    test('taken out again loses what the pick put there, and nothing else of that group or of the others', () => {
        const others = [
            condition(1, 108),
            condition(2, 105),
            condition(2, null, true),
            condition(2, 106, true),
        ]
        const picked = condition(2, 106)
        expect(pickedGroupIds([...others, picked], groups, regular)).toEqual([1, 2])
        expect(withPickedGroups([...others, picked], [1], groups, regular)).toEqual(others)
    })

    test('at an earlier order is kept when the other groups are picked', () => {
        const earlier = condition(2, 105)
        expect(withPickedGroups([earlier], [1], groups, regular)).toEqual([earlier, condition(1, 108)])
    })
})
