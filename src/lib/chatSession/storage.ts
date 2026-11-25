import { z } from 'zod'
import type { ChatSessionBrowser } from './browser'

/**
 * What the browser keeps of its session with the chat. The server keeps nothing of it.
 *
 * Between visits:
 *   ow.chat.session             the session, which is one user's at a time
 *   ow.chat.device.<Matrix id>  the device this browser is for that user, should the tokens be lost
 * In the tab:
 *   ow.chat.pending.<state>     what the answer of the chat's sign in is checked against when the
 *                               browser comes back from it
 *   ow.chat.signing-out         that the user is logging out here, see requestSignOut
 * In IndexedDB: what the SDK has synced, in a database per Matrix id, see syncStoreNameOf, and the
 * keys of the device, in two databases per device, see cryptoStoreNameOf.
 */
const SESSION_KEY = 'ow.chat.session'
const deviceKey = (userId: string) => `ow.chat.device.${userId}`
const pendingKey = (state: string) => `ow.chat.pending.${state}`
const SIGN_OUT_KEY = 'ow.chat.signing-out'
const SYNC_STORE_PREFIX = 'ow-chat-sync:'
// The SDK's store puts this before the name it is given, and that is the database's name.
const SDK_DATABASE_PREFIX = 'matrix-js-sdk:'
const CRYPTO_STORE_PREFIX = 'ow-chat-crypto:'
const OF_THE_CHAT = [`${SDK_DATABASE_PREFIX}${SYNC_STORE_PREFIX}`, CRYPTO_STORE_PREFIX]

/**
 * The name the SDK's store of what a user has synced is given. It is the user's own, so that what
 * one user synced is never opened as another's, also when it was not deleted as it should be.
 */
export const syncStoreNameOf = (userId: string) => `${SYNC_STORE_PREFIX}${userId}`

/**
 * The name the keys of a device are kept under, which the SDK puts first in the names of two
 * databases. It is the device's own: a device has the keys it was made with and no others, so
 * what another device left behind is never opened as this one's.
 */
export const cryptoStoreNameOf = (userId: string, deviceId: string) => `${CRYPTO_STORE_PREFIX}${userId}:${deviceId}`

const storedSessionSchema = z.object({
    userId: z.string(),
    deviceId: z.string(),
    accessToken: z.string(),
    refreshToken: z.string(),
})
export type StoredChatSession = z.infer<typeof storedSessionSchema>

const pendingSignInSchema = z.object({
    codeVerifier: z.string(),
    deviceId: z.string(),
})
export type PendingChatSignIn = z.infer<typeof pendingSignInSchema>

/** What is kept under a key, or null when it is nothing this code wrote. */
function read<Kept>(schema: z.ZodType<Kept>, raw: string | null): Kept | null {
    if (raw === null) return null
    try {
        return schema.parse(JSON.parse(raw))
    } catch {
        return null
    }
}

export function readStoredSession(browser: ChatSessionBrowser): StoredChatSession | null {
    return read(storedSessionSchema, browser.kept.getItem(SESSION_KEY))
}

export function storeSession(browser: ChatSessionBrowser, session: StoredChatSession): void {
    browser.kept.setItem(SESSION_KEY, JSON.stringify(session))
    browser.kept.setItem(deviceKey(session.userId), session.deviceId)
}

/**
 * Deletes what the SDK keeps in this browser, which is what it has synced and the keys of the
 * devices: of every user, or with `exceptOf` of every user and device but that one. A tab that has
 * a database open closes it when it is asked to, and the deletion then goes through by itself, so
 * one that is held up is not waited for. It never throws: a browser that will not say which
 * databases it has is one this can delete nothing in.
 */
export async function deleteChatStores(
    browser: ChatSessionBrowser,
    exceptOf?: { userId: string, deviceId: string },
): Promise<void> {
    const { indexedDB } = browser
    if (!indexedDB) return
    const isKept = (name: string) => exceptOf !== undefined && (
        name === `${SDK_DATABASE_PREFIX}${syncStoreNameOf(exceptOf.userId)}`
        || name.startsWith(`${cryptoStoreNameOf(exceptOf.userId, exceptOf.deviceId)}::`)
    )
    const databases = await Promise.resolve().then(() => indexedDB.databases()).catch(() => [])
    const names = databases
        .flatMap(({ name }) => name ?? [])
        .filter(name => OF_THE_CHAT.some(start => name.startsWith(start)))
        .filter(name => !isKept(name))
    await Promise.all(names.map(name => new Promise<void>(resolve => {
        const deletion = indexedDB.deleteDatabase(name)
        deletion.onsuccess = () => resolve()
        deletion.onerror = () => resolve()
        deletion.onblocked = () => resolve()
    })))
}

/**
 * Forgets the session with its device, since a device lives as long as its session: the next sign
 * in is then a new device. What was synced goes too, and the keys the device read its encrypted
 * rooms with, whoever they were of, so nothing of one user is left for the next. The session is
 * forgotten before anything is waited for.
 */
export async function forgetSession(browser: ChatSessionBrowser): Promise<void> {
    const session = readStoredSession(browser)
    browser.kept.removeItem(SESSION_KEY)
    if (session) browser.kept.removeItem(deviceKey(session.userId))
    await deleteChatStores(browser)
}

export function readDeviceId(browser: ChatSessionBrowser, userId: string): string | null {
    return browser.kept.getItem(deviceKey(userId))
}

export function storePendingSignIn(browser: ChatSessionBrowser, state: string, pending: PendingChatSignIn): void {
    browser.keptInTab.setItem(pendingKey(state), JSON.stringify(pending))
}

/** What a sign in was started with, once: an answer with a state that was taken before finds nothing. */
export function takePendingSignIn(browser: ChatSessionBrowser, state: string): PendingChatSignIn | null {
    const pending = read(pendingSignInSchema, browser.keptInTab.getItem(pendingKey(state)))
    browser.keptInTab.removeItem(pendingKey(state))
    return pending
}

/**
 * Says, in this tab, that the user is logging out here and the browser is to be signed out of the
 * chat on the way. Only the logout page says so, see LogOut: the page that signs out can be opened
 * from a link anywhere, and does nothing without this.
 */
export function requestSignOut(browser: ChatSessionBrowser): void {
    browser.keptInTab.setItem(SIGN_OUT_KEY, 'requested')
}

/** Whether a sign out was asked for in this tab. It is asked for once: taking it spends it. */
export function takeSignOutRequest(browser: ChatSessionBrowser): boolean {
    const isRequested = browser.keptInTab.getItem(SIGN_OUT_KEY) !== null
    browser.keptInTab.removeItem(SIGN_OUT_KEY)
    return isRequested
}
