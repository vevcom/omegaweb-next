import { loadChatSdk, oauthOf } from './sdk'
import { deleteSyncStores, readDeviceId, storePendingSignIn, storeSession, takePendingSignIn } from './storage'
import type { ChatSessionBrowser } from './browser'
import type { StoredChatSession } from './storage'
import type { ChatSessionConfig } from '@/services/chat/session/types'

// The chat's sign in refuses a device id of fewer than ten characters.
const DEVICE_ID_LENGTH = 12
const STATE_LENGTH = 24
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

/** A string of the alphabet, each letter as likely as another: a byte past the last whole run of it is drawn again. */
function randomString(length: number): string {
    const evenBelow = 256 - 256 % ALPHABET.length
    let letters = ''
    while (letters.length < length) {
        const bytes = crypto.getRandomValues(new Uint8Array(length - letters.length))
        letters += Array.from(bytes).filter(byte => byte < evenBelow).map(byte => ALPHABET[byte % ALPHABET.length]).join('')
    }
    return letters
}

/**
 * Where the browser goes to sign in to the chat: its sign in, asked for the device this browser
 * already is for the user, or for a new one. What the answer is to match is kept in the tab until
 * it comes back to `redirectUri`.
 */
export async function startSignIn(
    config: ChatSessionConfig,
    browser: ChatSessionBrowser,
    redirectUri: string,
): Promise<string> {
    const knownDeviceId = config.matrixUserId ? readDeviceId(browser, config.matrixUserId) : null
    const oauth = await oauthOf(config, browser, { deviceId: knownDeviceId ?? randomString(DEVICE_ID_LENGTH) })
    const state = randomString(STATE_LENGTH)
    storePendingSignIn(browser, state, {
        codeVerifier: oauth.context.codeVerifier,
        deviceId: oauth.context.deviceId,
    })
    return oauth.generateAuthorizationCodeGrantUrl(state, redirectUri, 'fragment')
}

export type ChatSignInRefusal =
    /** The answer is to no sign in this tab started, or to one that is already answered. */
    | 'NOT_STARTED_HERE'
    /** The chat's sign in gave no code. */
    | 'REFUSED'
    /** The tokens are another user's than the one signed in here, and are revoked. */
    | 'OTHER_ACCOUNT'

export type ChatSignInResult =
    | { signedIn: true, session: StoredChatSession }
    | { signedIn: false, refusal: ChatSignInRefusal }

/**
 * Takes the answer of the chat's sign in, trades its code for tokens, and keeps them when they are
 * the signed-in user's. The chat's sign in has a session of its own that outlives the one here, so
 * it may answer for whoever used the browser last.
 */
export async function completeSignIn(
    config: ChatSessionConfig,
    browser: ChatSessionBrowser,
    redirectUri: string,
    answer: URLSearchParams,
): Promise<ChatSignInResult> {
    const pending = takePendingSignIn(browser, answer.get('state') ?? '')
    if (!pending) return { signedIn: false, refusal: 'NOT_STARTED_HERE' }
    const code = answer.get('code')
    if (!code) return { signedIn: false, refusal: 'REFUSED' }

    const oauth = await oauthOf(config, browser, pending)
    const tokens = await oauth.completeAuthorizationCodeGrant(code, redirectUri)
    if (!tokens.refresh_token) throw new Error('The sign in of the chat gave no refresh token')
    const { createClient } = await loadChatSdk()
    const who = await createClient({
        baseUrl: config.homeserverUrl,
        accessToken: tokens.access_token,
        fetchFn: browser.fetch,
    }).whoami()
    if (who.user_id !== config.matrixUserId) {
        await oauth.revokeToken(tokens.refresh_token, 'refresh_token')
        await deleteSyncStores(browser)
        return { signedIn: false, refusal: 'OTHER_ACCOUNT' }
    }

    const session = {
        userId: who.user_id,
        deviceId: who.device_id ?? pending.deviceId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
    }
    storeSession(browser, session)
    return { signedIn: true, session }
}
