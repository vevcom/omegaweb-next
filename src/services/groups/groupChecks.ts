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
 * Refuses a new order of a list unless it holds every existing id exactly once. A list that was
 * read before an item was added or removed is stale, and applying it would leave items unplaced.
 */
export function assertIsReorderingOf(orderedIds: number[], existingIds: number[]): void {
    const existing = new Set(existingIds)
    const isReordering = orderedIds.length === existing.size
        && new Set(orderedIds).size === orderedIds.length
        && orderedIds.every(id => existing.has(id))
    if (!isReordering) {
        throw new ServiceError(
            'BAD PARAMETERS',
            'Listen er endret siden den ble lastet inn. Last inn siden på nytt og prøv igjen.'
        )
    }
}

/**
 * The group's pensioned flag, with the name of its own type's row. Only the group types that are
 * migrated by hand have a name here, and only they can be pensioned.
 */
async function readPensionableGroup(prisma: PrismaPossibleTransaction<false>, groupId: number) {
    const select = { select: { name: true } } as const
    const group = await prisma.group.findUnique({
        where: { id: groupId },
        select: { pensioned: true, committee: select, interestGroup: select, manualGroup: select },
    })
    if (!group) return null
    const name = (group.committee ?? group.interestGroup ?? group.manualGroup)?.name ?? 'Gruppen'
    return { name, pensioned: group.pensioned }
}

/**
 * Whether the group has been pensioned - retired rather than migrated. Only the group types that are
 * migrated by hand can be pensioned; for the rest this is always false.
 */
export async function isGroupPensioned(
    prisma: PrismaPossibleTransaction<false>,
    groupId: number,
): Promise<boolean> {
    return Boolean((await readPensionableGroup(prisma, groupId))?.pensioned)
}

/**
 * Refuses anything that would change a pensioned group. A pensioned group is history: the only thing
 * that may still happen to it is being brought back.
 */
export async function assertGroupNotPensioned(
    prisma: PrismaPossibleTransaction<false>,
    groupId: number,
): Promise<void> {
    const group = await readPensionableGroup(prisma, groupId)
    if (group?.pensioned) {
        throw new ServiceError(
            'BAD PARAMETERS',
            `${group.name} er pensjonert og kan ikke endres. Gjenopprett den først.`
        )
    }
}
