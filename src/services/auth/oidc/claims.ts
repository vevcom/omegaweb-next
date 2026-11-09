import '@pn-server-only'
import { OIDC_MAIL_SCOPE } from './constants'
import { userOperations } from '@/services/users/operations'
import { mailboxesReceivedBy } from '@/services/mail/received'

/** The claims of a user, by name. `groups` is a list; the standard ones are strings. */
export type UserClaims = Record<string, string | string[]>

/**
 * What the scopes say about a user. The standard ones of OpenID Connect Core section 5.4: `profile`
 * names them and `email` gives the address. The mail scope gives `groups`, the mailboxes the user
 * may open, by which the mail server knows what to show them. In the ID token, the access token and
 * at the userinfo endpoint alike. The subject is not among them, since the token carries it as `sub`.
 */
export async function userClaims(userId: number, scopes: readonly string[]): Promise<UserClaims> {
    const user = await userOperations.read({ params: { id: userId }, bypassAuth: true })
    return {
        ...(scopes.includes('profile') ? {
            preferred_username: user.username,
            name: `${user.firstname} ${user.lastname}`,
            given_name: user.firstname,
            family_name: user.lastname,
        } : {}),
        ...(scopes.includes('email') ? { email: user.email } : {}),
        ...(scopes.includes(OIDC_MAIL_SCOPE) ? { groups: await mailboxesReceivedBy(userId) } : {}),
    }
}
