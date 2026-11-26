import { loadChatCryptoSdk, loadChatSdk } from './sdk'
import { cryptoStoreNameOf } from './storage'
import type { ChatSessionBrowser } from './browser'
import type { StoredChatSession } from './storage'
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk'

/**
 * Starts the encryption of a client, so it reads and writes the rooms that are encrypted. The
 * keys of its device are kept in the browser, in databases of the device's own, and are the only
 * copy of them. The SDK does the encryption with code that is WebAssembly, which it fetches from
 * the site when this is called. A browser without IndexedDB has nowhere to keep the keys, and a
 * device that lost them could not be told from one that never had any, so there nothing is
 * started and an encrypted room cannot be read. So it is where the encryption of a device that
 * has kept no keys yet does not start: the rooms that are not encrypted are read and written in
 * all the same. A device that has kept keys is another matter. The homeserver gives a key sent to
 * a device once, at a sync, so a client that synced without its encryption would lose those keys
 * for good. There this rejects, and the client is not run.
 *
 * What is sent in an encrypted room says whom it mentions beside the encrypted part too, see
 * sayMentionsInTheClear.
 */
export async function startEncryption(
    client: MatrixClient,
    browser: ChatSessionBrowser,
    session: StoredChatSession,
): Promise<void> {
    if (!browser.indexedDB) return
    const prefix = cryptoStoreNameOf(session.userId, session.deviceId)
    const hasKeptKeys = await hasDatabaseOf(browser.indexedDB, prefix)
    const isStarted = await client.initRustCrypto({ cryptoDatabasePrefix: prefix }).then(() => true, (error: unknown) => {
        if (hasKeptKeys) throw error
        console.error('The encryption of the chat did not start', error)
        return false
    })
    if (!isStarted) return
    const [{ RoomEvent }] = await Promise.all([loadChatSdk(), loadChatCryptoSdk()])
    // The SDK tells of a message of the user's own each time it has come further on its way, and
    // the first time after it is encrypted is before it is sent.
    client.on(RoomEvent.LocalEchoUpdated, sayMentionsInTheClear)
}

/** Whether the browser holds a database the SDK made under the name, and yes where it will not say. */
async function hasDatabaseOf(indexedDB: IDBFactory, prefix: string): Promise<boolean> {
    const databases = await Promise.resolve().then(() => indexedDB.databases()).catch(() => null)
    return databases === null || databases.some(({ name }) => name?.startsWith(`${prefix}::`))
}

/**
 * Writes whom an encrypted message mentions beside its encrypted part, where the homeserver reads
 * it. The homeserver knows who writes and where already, and with this it counts a mention as one
 * and tells the app of it, so a mention is notified of in an encrypted room too. It is said only
 * of a message that mentions someone.
 */
function sayMentionsInTheClear(event: MatrixEvent): void {
    if (!event.isEncrypted()) return
    const mentions: unknown = event.getOriginalContent()['m.mentions']
    if (typeof mentions !== 'object' || mentions === null || Object.keys(mentions).length === 0) return
    event.getWireContent()['m.mentions'] = mentions
}
