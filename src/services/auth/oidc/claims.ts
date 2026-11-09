import '@pn-server-only'
import { userOperations } from '@/services/users/operations'

/**
 * What the standard scopes say about a user, see OpenID Connect Core section 5.4: `profile` names
 * them and `email` gives the address. In the ID token and at the userinfo endpoint alike. The
 * subject is not among them, since the token carries it as `sub`.
 */
export async function userClaims(userId: number, scopes: readonly string[]): Promise<Record<string, string>> {
    const user = await userOperations.read({ params: { id: userId }, bypassAuth: true })
    return {
        ...(scopes.includes('profile') ? {
            preferred_username: user.username,
            name: `${user.firstname} ${user.lastname}`,
            given_name: user.firstname,
            family_name: user.lastname,
        } : {}),
        ...(scopes.includes('email') ? { email: user.email } : {}),
    }
}
