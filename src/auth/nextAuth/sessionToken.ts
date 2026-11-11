import '@pn-server-only'
import { prisma } from '@/prisma-pn-client-instance'
import { userOperations } from '@/services/users/operations'
import { permissionOperations } from '@/services/permissions/operations'
import { groupOperations } from '@/services/groups/operations'
import type { JWT } from 'next-auth/jwt'

/** The login a session came from, which it carries so the checks on it can follow. */
export type LoginProvider = JWT['provider']

/**
 * The session token of a user, as the jwt callback builds it at sign in and rebuilds it when the
 * user has changed: the user, their permissions and memberships, and the epoch the session keeps.
 * The SSO callback builds the same token for a site from a code the auth domain issued, so a
 * session is the same whichever way it was started.
 *
 * @param sessionEpoch - The epoch the session started with. Left out at sign in, when it is read.
 */
export async function sessionTokenOf(userId: number, provider: LoginProvider, sessionEpoch?: number): Promise<JWT> {
    return {
        provider,
        sessionEpoch: sessionEpoch ?? (await prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { sessionEpoch: true },
        })).sessionEpoch,
        permissionsReadAt: Date.now(),
        user: await userOperations.read({ params: { id: userId }, bypassAuth: true }),
        permissions: await permissionOperations.readPermissionsOfUser({ params: { userId }, bypassAuth: true }),
        memberships: await groupOperations.readMembershipsOfUserOfAllTypes.internalCall({ params: { userId } }),
    }
}
