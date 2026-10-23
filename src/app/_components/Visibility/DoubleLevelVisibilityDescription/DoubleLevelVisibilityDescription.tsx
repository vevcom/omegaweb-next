'use client'
import { describeMatrix } from '@/auth/visibility/describeVisibility'
import { useGroups } from '@/contexts/ClientData'
import { flattenExpandedGroups } from '@/services/groups/flattenExpandedGroups'
import type { DoubleLevelVisibilityMatrix } from '@/services/visibility/types'

type PropTypes = {
    doubleLevelVisibility: DoubleLevelVisibilityMatrix,
}

/**
 * A human readable "who can see / who administrates" description of a DoubleLevelVisibilityMatrix -
 * reusable by any service built on `implementDoubleLevelVisibilityOperations`, not just image collections.
 */
export default function DoubleLevelVisibilityDescription({ doubleLevelVisibility }: PropTypes) {
    const groupsResult = useGroups()
    const groups = groupsResult.status === 'success' ? flattenExpandedGroups(groupsResult.groups) : null

    return (
        <p className="flex flex-col gap-[0.2em] mt-[0.5em] text-s opacity-85">
            <span>
                Kan se: {describeMatrix(doubleLevelVisibility.regularLevel, groups)}
                {doubleLevelVisibility.regularLevel.requirements.length > 0 && ' I tillegg alle som kan administrere.'}
            </span>
            <span>Kan administrere: {describeMatrix(doubleLevelVisibility.adminLevel, groups)}</span>
        </p>
    )
}
