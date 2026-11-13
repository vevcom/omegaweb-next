import type { AuthResult } from './AuthResult'
import type { SessionMaybeUser, UserGuaranteeOption } from '@/auth/session/Session'

export type UserRequiredOutOpt = 'USER_NOT_REQUIRED_FOR_AUTHORIZED' | 'USER_REQUIRED_FOR_AUTHORIZED'

/**
 * The contract every authorizer satisfies, regardless of how it's built — currently only the
 * `Require` builder (see `Require.ts`) — so `defineOperation`'s `authorizer:` getter, and the
 * client-side `useAuthorizer` hook, only need to know about this one shared shape.
 */
export type Authorizer<
    UserRequiredOut extends UserRequiredOutOpt = 'USER_NOT_REQUIRED_FOR_AUTHORIZED' | 'USER_REQUIRED_FOR_AUTHORIZED',
    PrismaWhereFilter extends object | undefined = undefined
> = {
    auth: (session: SessionMaybeUser) => UserRequiredOut extends 'USER_REQUIRED_FOR_AUTHORIZED'
    ? (AuthResult<'HAS_USER', true, PrismaWhereFilter> | AuthResult<UserGuaranteeOption, false, undefined>)
    : (AuthResult<UserGuaranteeOption, true, PrismaWhereFilter> | AuthResult<UserGuaranteeOption, false, undefined>),
    /** Rejects a `Require` chain that has not been given all its data via `.data()`. */
    readonly missingData?: never,
}
