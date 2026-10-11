import '@pn-server-only'
import type { Prisma } from '@/prisma-generated-pn-types'

/**
 * Invalidates the session data of a user. This must be done after changing data that is held in
 * the JWT - except data on the user model itself, where it happens on its own: the JWT callback
 * reloads what it holds for a user whose row changed after the token was issued, so touching
 * `updatedAt` is what does it. Call it on the transaction that makes the change, so a session can
 * never outlive the memberships or permissions it was issued for.
 */
export async function invalidateOneUserSessionData(prisma: Prisma.TransactionClient, userId: number): Promise<void> {
    await prisma.user.update({
        where: { id: userId },
        data: { updatedAt: new Date() },
    })
}

/** As {@link invalidateOneUserSessionData}, for several users. */
export async function invalidateManyUserSessionData(prisma: Prisma.TransactionClient, userIds: number[]): Promise<void> {
    await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { updatedAt: new Date() },
    })
}

/** As {@link invalidateOneUserSessionData}, for every user. Only use when strictly necessary. */
export async function invalidateAllUserSessionData(prisma: Prisma.TransactionClient): Promise<void> {
    await prisma.user.updateMany({
        data: { updatedAt: new Date() },
    })
}
