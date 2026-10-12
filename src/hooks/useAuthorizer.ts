import { useSession } from '@/auth/session/useSession'
import { AuthResult } from '@/auth/authorizer/AuthResult'
import { Session, type UserGuaranteeOption } from '@/auth/session/Session'
import type { Authorizer } from '@/auth/authorizer/Authorizer'

/**
 * This function applies an authorizer to the current client side session stored. While
 * this session is still loading, it will return an AuthResult with authorized set to false.
 * @param param0
 */
function useAuthorizer({
    authorizer
}: {
    authorizer: Authorizer<'USER_NOT_REQUIRED_FOR_AUTHORIZED'>
}): AuthResult<UserGuaranteeOption, boolean, object | undefined>
function useAuthorizer({
    authorizer
}: {
    authorizer: Authorizer<'USER_REQUIRED_FOR_AUTHORIZED'>
}): AuthResult<UserGuaranteeOption, false, object | undefined> | AuthResult<'HAS_USER', true, object | undefined>
function useAuthorizer({
    authorizer
}: {
    authorizer: Authorizer
}): AuthResult<UserGuaranteeOption, boolean, object | undefined> {
    const session = useSession()
    if (session.loading) {
        return new AuthResult(Session.empty(), false, undefined)
    }
    return authorizer.auth(session.session)
}

export default useAuthorizer
