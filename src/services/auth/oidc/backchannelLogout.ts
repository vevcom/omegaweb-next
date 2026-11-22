import '@ow-server-only'
import { OIDC_BACKCHANNEL_LOGOUT_TIMEOUT_MS } from './constants'

/**
 * Tells a client that a session has ended: its logout token, posted to the client's address as a
 * form, OpenID Connect Back-Channel Logout 1.0 section 2.5. Once, and for no longer than
 * OIDC_BACKCHANNEL_LOGOUT_TIMEOUT_MS. It throws when the client did not take the token, saying how
 * and never what was sent. A redirect is not followed, so the token goes to that address alone.
 */
export async function postLogoutToken(address: string, logoutToken: string): Promise<void> {
    const response = await fetch(address, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ logout_token: logoutToken }).toString(),
        redirect: 'manual',
        signal: AbortSignal.timeout(OIDC_BACKCHANNEL_LOGOUT_TIMEOUT_MS),
    })
    // An answer nobody reads holds its connection until it is collected.
    await response.body?.cancel()
    if (!response.ok) throw new Error(`The client answered ${response.status}`)
}
