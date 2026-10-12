import { ServiceError } from '@/services/error'
import { checkGroupValidity } from '@/lib/groups/checkGroupValidity'
import type { ValidatedGroup } from '@/lib/groups/checkGroupValidity'
import type {
    Class,
    Committee,
    InterestGroup,
    ManualGroup,
    OmegaMembershipGroup,
    StudyProgramme,
} from '@/prisma-generated-pn-types'
import type { GroupWithDumbRelations } from '@/services/groups/types'

/**
 * Throwing convenience wrapper around `checkGroupValidity` (from `@/lib/groups/checkGroupValidity`)
 * for the common case where the caller has no special handling for an invalid group and just wants
 * the call to fail. `checkGroupValidity` itself never throws - it's a plain lib util - so that
 * decision lives here, in the service layer.
 * @throws - If the group is invalid, for example groupType committee but no committee relation
 * @returns - The group with the correct relation (better typing)
 */
export function assertGroupValidity<
    CommitteeKeys extends keyof Committee,
    ManualGroupKeys extends keyof ManualGroup,
    ClassKeys extends keyof Class,
    InterestGroupKeys extends keyof InterestGroup,
    OmegaMembershipGroupKeys extends keyof OmegaMembershipGroup,
    StudyProgrammeKeys extends keyof StudyProgramme,
    ExtraFields extends object,
>(group: GroupWithDumbRelations<
    CommitteeKeys,
    ManualGroupKeys,
    ClassKeys,
    InterestGroupKeys,
    OmegaMembershipGroupKeys,
    StudyProgrammeKeys
> & ExtraFields): ValidatedGroup<
    CommitteeKeys, ManualGroupKeys, ClassKeys, InterestGroupKeys, OmegaMembershipGroupKeys, StudyProgrammeKeys, ExtraFields
> {
    const result = checkGroupValidity(group)
    if (!result.valid) {
        throw new ServiceError('SERVER ERROR', 'Ånei, serveren er i en invalid tilstand. Kontakt en administrator')
    }
    return result.group
}
