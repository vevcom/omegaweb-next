'use client'
import { useGroups } from '@/contexts/ClientData'
import { flattenExpandedGroups } from '@/services/groups/flattenExpandedGroups'
import type { ExpandedGroup } from '@/services/groups/types'

/** Every group as one list, for naming the groups of a visibility. `null` until they are loaded. */
export default function useFlatGroups(): ExpandedGroup[] | null {
    const groupsResult = useGroups()
    return groupsResult.status === 'success' ? flattenExpandedGroups(groupsResult.groups) : null
}
