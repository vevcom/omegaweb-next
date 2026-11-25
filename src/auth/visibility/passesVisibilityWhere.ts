import type { Prisma } from '@/prisma-generated-pn-types'
import type { VisibilityMatrix } from '@/services/visibility/types'

/**
 * The users passing a visibility, as a filter: the Prisma mirror of `checkVisibility`. Every
 * requirement needs some condition met by a membership.
 */
export function passesVisibilityWhere(visibility: VisibilityMatrix): Prisma.UserWhereInput {
    return {
        AND: visibility.requirements.map(requirement => ({
            memberships: {
                some: {
                    OR: requirement.conditions.map(condition => ({
                        groupId: condition.groupId,
                        ...(condition.order === null ? {} : { order: condition.order }),
                        ...(condition.onlyActive ? { active: true } : {}),
                        ...(condition.onlyAdmins ? { admin: true } : {}),
                    })),
                },
            },
        })),
    }
}
