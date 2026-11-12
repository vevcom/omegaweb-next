import type { Permission } from '@/prisma-generated-pn-types'
import type { UserFiltered } from '@/services/users/types'
import type { MembershipFiltered } from '@/services/groups/types'
import type { CompanyUserOfSession } from '@/services/careers/companies/users/types'

/**
 * Whose a session is. A session belongs to a user, to a company user or to no one, and never to
 * two of them: `'HAS_USER'`, `'HAS_COMPANY_USER'` and `'NO_USER'`.
 */
export type UserGuaranteeOption = 'HAS_USER' | 'HAS_COMPANY_USER' | 'NO_USER'

/**
 * What a session holds of who it belongs to, by what is known of it. A lookup and not a conditional
 * type on purpose: with a conditional, TypeScript accepts a session that may lack a user where one
 * with a user is required.
 *
 * Only a user has memberships. A company user is no member of anything in Omega, and neither is a
 * visitor, so their memberships are typed as the empty list and nothing else.
 */
type OwnerOfGuarantee = {
    HAS_USER: {
        user: UserFiltered,
        companyUser?: null,
        memberships: MembershipFiltered[],
    },
    HAS_COMPANY_USER: {
        user: null,
        companyUser: CompanyUserOfSession,
        memberships: [],
    },
    NO_USER: {
        user: null,
        companyUser?: null,
        memberships: [],
    },
}

export type SessionType<UserGuarantee extends UserGuaranteeOption> = OwnerOfGuarantee[UserGuarantee] & {
    permissions: Permission[],
    apiKeyId?: number,
}

export type SessionUser = SessionType<'HAS_USER'>
export type SessionCompanyUser = SessionType<'HAS_COMPANY_USER'>
export type SessionNoUser = SessionType<'NO_USER'>
/** A session of any of the three kinds. The name is from when a session had a user or none. */
export type SessionMaybeUser = SessionUser | SessionCompanyUser | SessionNoUser

/**
 * What a session cookie carries of who it belongs to, before it is known which kind it is: both
 * owners side by side. {@link Session.fromToken} decides, and what comes out is one of the three.
 */
export type SessionOfToken = {
    user: UserFiltered | null,
    companyUser: CompanyUserOfSession | null,
    permissions: Permission[],
    memberships: MembershipFiltered[],
}

export class Session<UserGuarantee extends UserGuaranteeOption> {
    private session: SessionType<UserGuarantee>

    protected constructor(session: SessionType<UserGuarantee>) {
        this.session = session
    }

    public get user(): SessionType<UserGuarantee>['user'] {
        return this.session.user
    }

    /** The company user the session belongs to, null for a session of a user or of no one. */
    public get companyUser(): NonNullable<SessionType<UserGuarantee>['companyUser']> | null {
        return this.session.companyUser ?? null
    }

    public get permissions() {
        return this.session.permissions
    }

    public get memberships(): SessionType<UserGuarantee>['memberships'] {
        return this.session.memberships
    }

    public get apiKeyId() {
        return this.session.apiKeyId
    }

    /**
     * This functions makes sure the Session class can be sent to the client
     * @returns A javascript object representation of the session
     */
    public toJsObject(): SessionType<UserGuarantee> {
        return { ...this.session }
    }

    public static empty(): Session<'NO_USER'> {
        return new Session<'NO_USER'>({ user: null, permissions: [], memberships: [] })
    }

    public static fromJsObject(jsObject: SessionMaybeUser): AnySession {
        if (jsObject.user) return new Session<'HAS_USER'>(jsObject)
        if (jsObject.companyUser) return new Session<'HAS_COMPANY_USER'>(jsObject)
        return new Session<'NO_USER'>(jsObject)
    }

    /**
     * The session a cookie carries. A token names at most one owner, and should one ever name both,
     * the user wins and the company user is dropped, so no session is ever both. Memberships are
     * kept for a user alone.
     */
    public static fromToken(token: SessionOfToken): AnySession {
        const { permissions } = token
        if (token.user) return new Session<'HAS_USER'>({ user: token.user, permissions, memberships: token.memberships })
        if (token.companyUser) {
            return new Session<'HAS_COMPANY_USER'>({
                user: null,
                companyUser: token.companyUser,
                permissions,
                memberships: [],
            })
        }
        return new Session<'NO_USER'>({ user: null, permissions, memberships: [] })
    }

    public static fromDefaultPermissions(defaultPermissions: Permission[]): Session<'NO_USER'> {
        return new Session<'NO_USER'>({ permissions: defaultPermissions, memberships: [], user: null })
    }
}

/** A session of any of the three kinds, as the class. */
export type AnySession = Session<'HAS_USER'> | Session<'HAS_COMPANY_USER'> | Session<'NO_USER'>
