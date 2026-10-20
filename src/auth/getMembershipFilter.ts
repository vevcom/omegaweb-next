import type { MembershipSelectorType } from '@/services/groups/types'
import type { Prisma } from '@/prisma-generated-pn-types'

/**
 * A function to return a filter that only selects valid memberships of a order.
 * @param order - The order of what is considered valid membership. ¨
 * Or 'ACTIVE' to only select active memberships.
 * Or 'ALL' to select all memberships
 * @param groupId - The id of the group to filter by. I.e only memberships of this group.
 * @param admin - If the membership should be admin or not (default false).
 * @returns - A filter that only selects valid memberships of a order.
 */
export function getMembershipFilter(
    order: MembershipSelectorType,
    groupId?: number,
    admin: boolean | undefined = undefined
) {
    return {
        groupId,
        admin,
        active: order === 'ACTIVE' ? true : undefined,
        order: typeof order === 'number' ? order : undefined
    } satisfies Prisma.MembershipWhereInput
}
