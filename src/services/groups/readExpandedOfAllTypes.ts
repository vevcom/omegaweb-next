import '@pn-server-only'
import { classAuth } from './classes/auth'
import { classOperations } from './classes/operations'
import { committeeAuth } from './committees/auth'
import { committeeOperations } from './committees/operations'
import { interestGroupAuth } from './interestGroups/auth'
import { interestGroupOperations } from './interestGroups/operations'
import { manualGroupAuth } from './manualGroups/auth'
import { manualGroupOperations } from './manualGroups/operations'
import { omegaMembershipGroupAuth } from './omegaMembershipGroups/auth'
import { omegaMembershipGroupOperations } from './omegaMembershipGroups/operations'
import { studyProgrammeAuth } from './studyProgrammes/auth'
import { studyProgrammeOperations } from './studyProgrammes/operations'
import { defineOperation } from '@/services/serviceOperation'
import { Require } from '@/auth/authorizer/Require'
import { GroupType } from '@/prisma-generated-pn-types'
import type { ExpandedGroupsOfAllTypes } from './types'

/**
 * Each group type's own expanded read, together with the authorizer guarding it. This is the only
 * place that knows about every group type at once - it exists so that the client side group cache
 * can be filled in a single call, without reintroducing a read across all groups.
 */
const groupTypeExpandedReads = {
    CLASS: {
        auth: classAuth.readExpanded,
        readExpanded: classOperations.readExpanded,
    },
    COMMITTEE: {
        auth: committeeAuth.readExpanded,
        readExpanded: committeeOperations.readExpanded,
    },
    INTEREST_GROUP: {
        auth: interestGroupAuth.readExpanded,
        readExpanded: interestGroupOperations.readExpanded,
    },
    MANUAL_GROUP: {
        auth: manualGroupAuth.readExpanded,
        readExpanded: manualGroupOperations.readExpanded,
    },
    OMEGA_MEMBERSHIP_GROUP: {
        auth: omegaMembershipGroupAuth.readExpanded,
        readExpanded: omegaMembershipGroupOperations.readExpanded,
    },
    STUDY_PROGRAMME: {
        auth: studyProgrammeAuth.readExpanded,
        readExpanded: studyProgrammeOperations.readExpanded,
    },
} as const satisfies Record<GroupType, {
    auth: typeof committeeAuth.readExpanded,
    readExpanded: typeof committeeOperations.readExpanded,
}>

/**
 * Reads the expanded groups of every group type the session is allowed to see.
 *
 * A group type the session may not read comes back as `null` rather than as an empty list, so that
 * a caller can tell "you have no access to these" apart from "there are none of these". The
 * operation itself requires nothing: what the session may see is decided per group type.
 */
export const readExpandedOfAllTypes = defineOperation({
    authorizer: () => Require.nothing(),
    operation: async ({ session }): Promise<ExpandedGroupsOfAllTypes> => {
        const entries = await Promise.all(
            Object.values(GroupType).map(async groupType => {
                const { auth, readExpanded } = groupTypeExpandedReads[groupType]

                if (!auth.auth(session).authorized) {
                    return [groupType, null] as const
                }

                return [groupType, await readExpanded({ })] as const
            })
        )

        return Object.fromEntries(entries) as ExpandedGroupsOfAllTypes
    }
})
