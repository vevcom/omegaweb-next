import '@pn-server-only'
import { permissionsMaxAge } from './constants'
import { prisma } from '@/prisma-pn-client-instance'
import { userOperations } from '@/services/users/operations'
import { permissionOperations } from '@/services/permissions/operations'
import { groupOperations } from '@/services/groups/operations'
import { companyUserOfSessionSelection } from '@/services/careers/companies/users/constants'
import type { JWT } from 'next-auth/jwt'

/** The login a session came from, which it carries so the checks on it can follow. */
export type LoginProvider = JWT['provider']

/** The logins of a user, as opposed to that of a company user. */
export type UserLoginProvider = Exclude<LoginProvider, 'company-credentials'>

/**
 * The session token of a user, as the jwt callback builds it at sign in and rebuilds it when the
 * user has changed: the user, their permissions and memberships, and the epoch the session keeps.
 * The SSO callback builds the same token for a site from a code the auth domain issued, so a
 * session is the same whichever way it was started.
 *
 * @param sessionEpoch - The epoch the session started with. Left out at sign in, when it is read.
 */
export async function sessionTokenOf(userId: number, provider: UserLoginProvider, sessionEpoch?: number): Promise<JWT> {
    return {
        provider,
        sessionEpoch: sessionEpoch ?? (await prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { sessionEpoch: true },
        })).sessionEpoch,
        permissionsReadAt: Date.now(),
        user: await userOperations.read({ params: { id: userId }, bypassAuth: true }),
        companyUser: null,
        permissions: await permissionOperations.readPermissionsOfUser({ params: { userId }, bypassAuth: true }),
        memberships: await groupOperations.readMembershipsOfUserOfAllTypes.internalCall({ params: { userId } }),
    }
}

/**
 * The session token of a company user: the company user and the company they act for, and the
 * permissions every visitor has. A company user holds no permission of their own and is a member
 * of nothing, so what they may do beyond a visitor comes from the company conditions of `Require`.
 *
 * @param sessionEpoch - The epoch the session started with. Left out at sign in, when it is read.
 */
export async function companySessionTokenOf(companyUserId: number, sessionEpoch?: number): Promise<JWT> {
    const companyUser = await prisma.companyUser.findUniqueOrThrow({
        where: { id: companyUserId },
        select: { ...companyUserOfSessionSelection, sessionEpoch: true },
    })
    const { sessionEpoch: currentEpoch, ...companyUserOfSession } = companyUser
    return {
        provider: 'company-credentials',
        sessionEpoch: sessionEpoch ?? currentEpoch,
        permissionsReadAt: Date.now(),
        user: null,
        companyUser: companyUserOfSession,
        permissions: await permissionOperations.readDefaultPermissions({ bypassAuth: true }),
        memberships: [],
    }
}

/**
 * Whether the company user of a session may still have it: they exist, are active, have a password
 * to have signed in with, and have not ended their sessions since this one started.
 */
export async function companySessionStillStands(token: JWT): Promise<boolean> {
    if (!token.companyUser) return false
    const companyUser = await prisma.companyUser.findUnique({
        where: { id: token.companyUser.id },
        select: { active: true, sessionEpoch: true, credentials: { select: { companyUserId: true } } },
    })
    return companyUser !== null
        && companyUser.active
        && companyUser.credentials !== null
        && companyUser.sessionEpoch === token.sessionEpoch
}

/**
 * The token of a company session as it should be now: the one it has while what it carries is
 * fresh, and one read again when the company user has changed since, or the permissions are old.
 */
export async function refreshedCompanySessionToken(token: JWT): Promise<JWT> {
    if (!token.companyUser) throw new Error('A session token of a company login names no company user')
    const companyUser = await prisma.companyUser.findUniqueOrThrow({
        where: { id: token.companyUser.id },
        select: { updatedAt: true, company: { select: { updatedAt: true } } },
    })
    const changedAt = Math.max(companyUser.updatedAt.getTime(), companyUser.company.updatedAt.getTime())
    const fresh = token.iat !== undefined
        && token.iat * 1000 > changedAt
        && Date.now() - token.permissionsReadAt < permissionsMaxAge
    return fresh ? token : companySessionTokenOf(token.companyUser.id, token.sessionEpoch)
}
