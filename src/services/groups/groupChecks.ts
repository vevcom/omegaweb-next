import '@pn-server-only'
import { ServiceError } from '@/services/error'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { GroupType } from '@/prisma-generated-pn-types'

/**
 * Whether the group is of the given type. Used as the ownership check of every common operation:
 * a group type's implementation must never be able to reach a group of another type through it.
 */
export async function isGroupOfType(
    prisma: PrismaPossibleTransaction<false>,
    groupId: number,
    type: GroupType,
): Promise<boolean> {
    const group = await prisma.group.findUnique({
        where: { id: groupId },
        select: { groupType: true },
    })
    return group?.groupType === type
}

/**
 * Whether the group has been pensioned - retired rather than migrated. Only the group types that are
 * migrated by hand carry the flag; for the rest this is always false.
 */
export async function isGroupPensioned(
    prisma: PrismaPossibleTransaction<false>,
    groupId: number,
): Promise<boolean> {
    const group = await prisma.group.findUnique({
        where: { id: groupId },
        select: {
            committee: { select: { pensioned: true } },
            interestGroup: { select: { pensioned: true } },
            manualGroup: { select: { pensioned: true } },
        },
    })

    return Boolean(
        group?.committee?.pensioned || group?.interestGroup?.pensioned || group?.manualGroup?.pensioned
    )
}

/**
 * Refuses anything that would change a pensioned group. A pensioned group is history: the only thing
 * that may still happen to it is being brought back.
 */
export async function assertGroupNotPensioned(
    prisma: PrismaPossibleTransaction<false>,
    groupId: number,
): Promise<void> {
    if (await isGroupPensioned(prisma, groupId)) {
        throw new ServiceError(
            'BAD PARAMETERS',
            'Gruppen er pensjonert og kan ikke endres. Gjenopprett den først.'
        )
    }
}
