import '@pn-server-only'
import type { Prisma } from '@/prisma-generated-pn-types'

/**
 * Closes the gaps deleting applications leaves in the priorities of the given users, so each
 * user's applications in the period run 1..n again.
 */
export async function renumberApplicationPriorities(
    tx: Prisma.TransactionClient,
    { applicationPeriodId, userIds }: { applicationPeriodId: number, userIds: number[] },
) {
    const applications = await tx.application.findMany({
        where: { applicationPeriodId, userId: { in: userIds } },
        orderBy: [{ userId: 'asc' }, { priority: 'asc' }],
        select: { id: true, userId: true, priority: true },
    })

    const nextPriority = new Map<number, number>()
    const moves = applications.flatMap(application => {
        const priority = (nextPriority.get(application.userId) ?? 0) + 1
        nextPriority.set(application.userId, priority)
        return application.priority === priority ? [] : [{ id: application.id, priority }]
    })

    // One at a time: (userId, applicationPeriodId, priority) is unique, and every move goes down
    // into the slot the move before it just left free.
    await moves.reduce(async (previous, move) => {
        await previous
        await tx.application.update({ where: { id: move.id }, data: { priority: move.priority } })
    }, Promise.resolve())
}
