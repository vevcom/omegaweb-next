import { Smorekopp } from '@/services/error'
import type { SessionType, UserGuaranteeOption } from '@/auth/session/Session'

export type AuthStatus = 'AUTHORIZED' | 'UNAUTHORIZED' | 'AUTHORIZED_NO_USER' | 'UNAUTHENTICATED'

export type AuthResultTypeWithoutStatus<
    UserGuarantee extends UserGuaranteeOption,
    Authorized extends boolean,
    PrismaWhereFilter extends object | undefined = undefined
> = {
    session: SessionType<UserGuarantee>,
    errorMessage?: string,
    authorized: Authorized,
    prismaWhereFilter: PrismaWhereFilter | undefined,
}

export type AuthResultType<
    UserGuarantee extends UserGuaranteeOption,
    Authorized extends boolean,
    PrismaWhereFilter extends object | undefined = undefined
> = AuthResultTypeWithoutStatus<UserGuarantee, Authorized, PrismaWhereFilter> & {
    status: AuthStatus
}

export type AuthResultTypeAny = AuthResultType<UserGuaranteeOption, boolean, object | undefined>

/** An AuthResult of any authorizer: what running one against a session gives, without the specifics. */
export type AuthResultAny = AuthResult<UserGuaranteeOption, boolean, object | undefined>

export class AuthResult<
    const UserGuarantee extends UserGuaranteeOption,
    const Authorized extends boolean,
    const PrismaWhereFilter extends object | undefined = undefined
> {
    private authResult: AuthResultTypeWithoutStatus<UserGuarantee, Authorized, PrismaWhereFilter>
    public get authorized() {
        return this.authResult.authorized
    }

    public get session(): SessionType<UserGuarantee> {
        return this.authResult.session
    }

    public get prismaWhereFilter(): PrismaWhereFilter | undefined {
        return this.authResult.prismaWhereFilter
    }

    public constructor(
        session: SessionType<UserGuarantee>,
        authorized: Authorized,
        prismaWhereFilter: PrismaWhereFilter | undefined,
        errorMessage?: string
    ) {
        this.authResult = {
            session,
            authorized,
            prismaWhereFilter,
            errorMessage,
        }
    }

    public get status(): AuthStatus {
        if (this.authResult.session.user) {
            if (this.authorized) return 'AUTHORIZED'
            return 'UNAUTHORIZED'
        }
        if (this.authorized) return 'AUTHORIZED_NO_USER'

        if (typeof this.authResult.session.apiKeyId === 'number') return 'UNAUTHORIZED'
        return 'UNAUTHENTICATED'
    }

    public get getErrorMessage(): string | undefined {
        return this.authResult.errorMessage
    }

    /**
     * The encoding in a JS object is useful for sending the AuthResult to the client
     * as you cannot send class instances to a client component from a server component.
     * @returns A javascript object representation of the AuthResult
     */
    public toJsObject(): AuthResultType<UserGuarantee, Authorized, PrismaWhereFilter> {
        return {
            session: {
                // Note: spread is neccessary if the session stored on the AuthResult is the Session class and
                // not the session object of Session type
                ...this.session,
            },
            authorized: this.authorized,
            errorMessage: this.getErrorMessage,
            status: this.status,
            prismaWhereFilter: this.authResult.prismaWhereFilter,
        }
    }

    public static fromJsObject<
        const UserGuarantee_ extends UserGuaranteeOption,
        const Authorized_ extends boolean,
        const PrismaWhereFilter_ extends object | undefined = undefined
    >(
        authResult: AuthResultType<UserGuarantee_, Authorized_, PrismaWhereFilter_>
    ): AuthResult<UserGuarantee_, Authorized_, PrismaWhereFilter_> {
        return new AuthResult(
            authResult.session, authResult.authorized, authResult.prismaWhereFilter, authResult.errorMessage
        )
    }

    /**
     * Throws the failure as a service error when the result is unauthorized, and otherwise
     * narrows the result to an authorized one. Inside a serverPage operation the thrown error
     * gets the conventional treatment: an anonymous user is sent to login (with a callbackUrl
     * back to the page) and a logged-in one gets the error view.
     */
    public requireAuthorized(): Authorized extends true ? AuthResult<UserGuarantee, true, PrismaWhereFilter> : never {
        if (!this.authorized) {
            throw new Smorekopp(this.status, this.getErrorMessage)
        }
        return new AuthResult<UserGuarantee, true, PrismaWhereFilter>(
            this.session, true, this.authResult.prismaWhereFilter
        ) as Authorized extends true ? AuthResult<UserGuarantee, true, PrismaWhereFilter> : never
    }
}
