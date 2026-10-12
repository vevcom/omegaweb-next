import type { Permission } from '@/prisma-generated-pn-types'
import type { UserFiltered } from '@/services/users/types'
import type { MembershipFiltered } from '@/services/groups/types'

export type UserGuaranteeOption = 'HAS_USER' | 'NO_USER'

/**
 * The `user` of a session by what is known of it. A lookup and not a conditional type on purpose:
 * with a conditional, TypeScript accepts a session that may lack a user where one with a user is
 * required.
 */
type UserOfGuarantee = {
    HAS_USER: UserFiltered,
    NO_USER: null,
}

export type SessionType<UserGuarantee extends UserGuaranteeOption> = {
    user: UserOfGuarantee[UserGuarantee],
    permissions: Permission[],
    memberships: MembershipFiltered[],
    apiKeyId?: number,
}

export type SessionUser = SessionType<'HAS_USER'>
export type SessionNoUser = SessionType<'NO_USER'>
export type SessionMaybeUser = SessionType<'HAS_USER'> | SessionType<'NO_USER'>

export class Session<UserGuarantee extends UserGuaranteeOption> {
    private session: SessionType<UserGuarantee>

    protected constructor(session: SessionType<UserGuarantee>) {
        this.session = session
    }

    public get user() {
        return this.session.user
    }

    public get permissions() {
        return this.session.permissions
    }

    public get memberships() {
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
        return {
            user: this.user,
            permissions: this.permissions,
            memberships: this.memberships,
            apiKeyId: this.apiKeyId,
        }
    }

    public static empty(): Session<'NO_USER'> {
        return new Session<'NO_USER'>({ user: null, permissions: [], memberships: [] })
    }

    public static fromJsObject(jsObject: SessionMaybeUser): Session<'NO_USER'> | Session<'HAS_USER'> {
        return jsObject.user ? new Session<'HAS_USER'>(jsObject) : new Session<'NO_USER'>(jsObject)
    }

    public static fromDefaultPermissions(defaultPermissions: Permission[]): Session<'NO_USER'> {
        return new Session<'NO_USER'>({ permissions: defaultPermissions, memberships: [], user: null })
    }
}
