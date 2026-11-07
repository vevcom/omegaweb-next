import '@pn-server-only'
import { checkVisibility } from '@/auth/visibility/checkVisibility'
import { toMatrix, visibilityIncluder } from '@/services/visibility/implement'
import { groupOperations } from '@/services/groups/operations'
import type { MembershipFiltered } from '@/services/groups/types'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'

/** The memberships a read marks what is owned by: the user's own, or none when no user was asked for. */
export function readMembershipsToMark({ prisma, userId }: {
    prisma: PrismaPossibleTransaction<false>,
    userId: number | undefined,
}): Promise<MembershipFiltered[]> {
    if (userId === undefined) return Promise.resolve([])
    return groupOperations.readMembershipsOfUserOfAllTypes.internalCall({ prisma, params: { userId } })
}

/** Includes the owner visibility of an alias or a mailing list as `markOwned` reads it. */
export const ownerVisibilityIncluder = {
    ownerVisibility: { include: visibilityIncluder },
} as const

type OwnerVisibility = Prisma.VisibilityGetPayload<{ include: typeof visibilityIncluder }>

/** Replaces the owner visibility of a node with whether the memberships pass it. */
export function markOwned<Node extends { ownerVisibility: OwnerVisibility }>(
    node: Node,
    memberships: MembershipFiltered[],
): Omit<Node, 'ownerVisibility'> & { owned: boolean } {
    const { ownerVisibility, ...rest } = node
    return { ...rest, owned: checkVisibility(memberships, toMatrix(ownerVisibility)) }
}

/** Whether the memberships make the session an administrator of the group. */
export function administrates(groupId: number, memberships: MembershipFiltered[]): boolean {
    return memberships.some(membership => membership.groupId === groupId && membership.active && membership.admin)
}
