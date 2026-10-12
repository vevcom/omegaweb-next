import '@pn-server-only'
import { prismaCall } from '@/services/prismaCall'
import { prisma } from '@/prisma-pn-client-instance'

/**
 * Invalidate a given user.
 * This must be done after modifying data that is stored in the JWT.
 * The *only* exception is modifying data that is on the user model
 * as this is done it automatically.
 *
 * @param userIds - The id of the user.
 */
export async function invalidateOneUserSessionData(userId: number): Promise<void> {
    await prismaCall(() => prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            // The JWT is invalid if it was created after the user model was updated
            updatedAt: new Date(),
        }
    }))
}

/**
 * Invalidate all JWTs for given users.
 * This must be done after modifying data that is stored in the JWT.
 * The *only* exception is modifying data that is on the user model
 * as this is done it automatically.
 *
 * @param userIds - The ids of the users.
 */
export async function invalidateManyUserSessionData(userIds: number[]): Promise<void> {
    await prismaCall(() => prisma.user.updateMany({
        where: {
            id: {
                in: userIds,
            },
        },
        data: {
            updatedAt: new Date(),
        },
    }))
}

/**
 * Invalidate all JWTs for *all* user.
 * This should be used only when strictly necessary.
 *
 * @param userIds - The ids of the users.
 */
export async function invalidateAllUserSessionData(): Promise<void> {
    await prismaCall(() => prisma.user.updateMany({
        data: {
            updatedAt: new Date(),
        },
    }))
}
