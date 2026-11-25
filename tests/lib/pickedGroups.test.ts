import { pickedGroupIds, withPickedGroups } from '@/components/Visibility/pickedGroups'
import {
    adminDefaultMembershipRequirements as admin,
    regularDefaultMembershipRequirements as regular,
} from '@/components/Visibility/defaultMembershipRequirements'
import { describe, expect, test } from '@jest/globals'
import { GroupType } from '@/prisma-generated-pn-types'
import type { DefaultMembershipRequirement, DefaultMembershipRequirements } from '@/components/Visibility/pickedGroups'
import type { ExpandedGroup } from '@/services/groups/types'
import type { VisibilityCondition } from '@/services/visibility/types'

// The revue group is an order behind the rest, as a group that migrates on its own is.
const groups = [
    { id: 1, name: 'Styret', groupType: 'COMMITTEE', order: 108 },
    { id: 2, name: 'Revystyret', groupType: 'COMMITTEE', order: 106 },
    { id: 3, name: 'Medlemmer', groupType: 'OMEGA_MEMBERSHIP_GROUP', order: 108 },
    { id: 4, name: 'Elektronikk', groupType: 'STUDY_PROGRAMME', order: 108 },
    { id: 5, name: '1. klasse', groupType: 'CLASS', order: 108 },
] as ExpandedGroup[]

function condition(groupId: number, order: number | null, onlyActive = false, onlyAdmins = false): VisibilityCondition {
    return { groupId, order, onlyActive, onlyAdmins }
}

describe('a picked group', () => {
    test('of any type starts as the active members of any order for those who administer', () => {
        expect(withPickedGroups([], [2, 3, 4, 5], groups, admin)).toEqual([
            condition(2, null, true),
            condition(3, null, true),
            condition(4, null, true),
            condition(5, null, true),
        ])
    })

    test('starts at its own current order for those who see, which need not be that of the others', () => {
        expect(withPickedGroups([], [1, 2, 5], groups, regular)).toEqual([
            condition(1, 108),
            condition(2, 106),
            condition(5, 108),
        ])
    })

    test('whose members stay active in the order they joined in starts as the active members of any order', () => {
        expect(withPickedGroups([], [3, 4], groups, regular)).toEqual([condition(3, null, true), condition(4, null, true)])
    })

    test('as the default put it is shown as picked, and taken out again', () => {
        const others = [condition(3, 108, true)]
        const picked = condition(3, null, true)
        expect(pickedGroupIds([...others, picked], groups, regular)).toEqual([3])
        expect(withPickedGroups([...others, picked], [], groups, regular)).toEqual(others)
    })

    test('starts at the order the owner names, and never as only the admins', () => {
        expect(withPickedGroups([], [1], groups, everyType({ order: 100, onlyActive: true }))).toEqual([
            condition(1, 100, true),
        ])
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

function everyType(requirement: DefaultMembershipRequirement) {
    return Object.fromEntries(
        Object.values(GroupType).map(groupType => [groupType, requirement])
    ) as DefaultMembershipRequirements
}
