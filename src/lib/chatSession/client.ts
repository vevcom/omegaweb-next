import { loadChatSdk, oauthOf } from './sdk'
import { recoveryCallbacks } from './recovery'
import { roomNameIn } from './rooms'
import { startEncryption } from './encryption'
import { deleteChatStores, forgetSession, readStoredSession, storeSession, syncStoreNameOf } from './storage'
import type { ChatSessionBrowser } from './browser'
import type { StoredChatSession } from './storage'
import type { ChatSessionConfig } from '@/services/chat/session/types'
import type { MatrixClient } from 'matrix-js-sdk'

const TAB_LOCK = 'ow.chat.client'

/**
 * The client of a kept session, ready to be started. The SDK trades the refresh token for new
 * tokens by itself as the access token runs out, and the new ones take the place of the kept. It
 * keeps what it syncs in a store of the user's own, and whatever another user or device has left
 * in the browser is deleted before it is opened. Its encryption is started, see startEncryption.
 */
export async function chatClientOf(
    config: ChatSessionConfig,
    browser: ChatSessionBrowser,
    session: StoredChatSession,
): Promise<MatrixClient> {
    const { createClient, IndexedDBStore, RoomNameType } = await loadChatSdk()
    await deleteChatStores(browser, session)
    const store = browser.indexedDB
        ? new IndexedDBStore({ indexedDB: browser.indexedDB, dbName: syncStoreNameOf(session.userId) })
        : undefined
    const client = createClient({
        baseUrl: config.homeserverUrl,
        userId: session.userId,
        deviceId: session.deviceId,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        oauthClientId: config.clientId,
        fetchFn: browser.fetch,
        store,
        disableVoip: true,
        cryptoCallbacks: recoveryCallbacks(),
        roomNameGenerator: roomNameIn(RoomNameType),
        onTokenRefresh: tokens => {
            const kept = readStoredSession(browser)
            if (kept?.userId !== session.userId || kept.deviceId !== session.deviceId) return
            storeSession(browser, {
                ...kept,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken ?? kept.refreshToken,
            })
        },
    })
    await store?.startup()
    await startEncryption(client, browser, session)
    return client
}

/** Stops a client and closes its store, which stopping alone leaves open. */
export function stopChatClient(client: MatrixClient): void {
    client.stopClient()
    void client.store.destroy()
}

/**
 * Signs the browser out of the chat: forgets the session, and ends it at the chat's sign in, which
 * removes the device from the homeserver. It is forgotten first, so that nothing is left here when
 * the chat cannot be reached, and it throws then.
 */
export async function signOut(config: ChatSessionConfig, browser: ChatSessionBrowser): Promise<void> {
    const session = readStoredSession(browser)
    await forgetSession(browser)
    if (!session) return
    const oauth = await oauthOf(config, browser)
    await oauth.revokeToken(session.refreshToken, 'refresh_token')
}

/**
 * Waits until this tab is the one that runs the client, and stays so until `until` is aborted or
 * the tab is closed. One tab runs it at a time: two would each trade the refresh token, write
 * what they sync to the same database, and use the keys of the one device, which two at once
 * would break. `onWaiting` is called when another tab is the one. `beforeLettingGo` is waited for
 * once `until` is aborted, so a client that is still being started is done with before another
 * tab starts its own.
 */
export async function holdTabLock(
    locks: ChatSessionBrowser['locks'],
    until: AbortSignal,
    onWaiting: () => void,
    beforeLettingGo: () => Promise<unknown> = () => Promise.resolve(),
): Promise<void> {
    const released = new Promise<void>(resolve => until.addEventListener('abort', () => {
        void beforeLettingGo().catch(() => undefined).then(() => resolve())
    }, { once: true }))
    const hold = (options: LockOptions) => new Promise<boolean>((resolve, reject) => {
        locks.request(TAB_LOCK, options, lock => {
            resolve(lock !== null)
            return lock ? released : undefined
        }).catch(reject)
    })
    until.throwIfAborted()
    if (await hold({ ifAvailable: true })) return
    onWaiting()
    await hold({ signal: until })
}
