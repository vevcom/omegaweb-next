import { loadedChatCryptoSdk, loadedChatSdk } from './sdk'
import type { ChatCryptoSdk } from './sdk'
import type { Watched } from './watch'
import type { MatrixClient } from 'matrix-js-sdk'
import type { CryptoApi, CryptoCallbacks, GeneratedSecretStorageKey } from 'matrix-js-sdk/lib/crypto-api'
import type { SecretStorageKeyDescription } from 'matrix-js-sdk/lib/secret-storage'

/**
 * Where a device stands with the user's recovery key, which is what lets a new device read what
 * was written before it was there.
 *
 *   LOOKING               not known yet
 *   NOTHING_ENCRYPTED     the account has no recovery key and the user is in no encrypted room,
 *                         so there is nothing to say: the homeserver may encrypt nothing at all
 *   UNAVAILABLE           the client has no encryption, see startEncryption
 *   NOT_SET_UP            the account has no recovery key, and this device may make one
 *   KEY_NEEDED            the account has one, and this device has not been given it
 *   IDENTITY_WITHOUT_KEY  the account was set up for encryption somewhere else and has no
 *                         recovery key, so there is none to enter and none is made from here
 *   READY                 this device has been given it, or made it
 */
export type Recovery =
    | 'LOOKING' | 'NOTHING_ENCRYPTED' | 'UNAVAILABLE' | 'NOT_SET_UP' | 'KEY_NEEDED' | 'IDENTITY_WITHOUT_KEY' | 'READY'

export type WatchedRecovery = Watched<Recovery> & {
    /**
     * Makes the account's recovery key and gives it, as the text the user is to save. It is given
     * here and never again: nothing keeps it, in the browser or on the homeserver. It rejects with
     * RecoveryIsSetUp, and changes nothing, where the account has a recovery key, a backup of
     * keys or an identity made elsewhere already. Where a step fails after the key may have become the account's, it rejects
     * with RecoveryUnfinished, which holds the key for the user to save all the same, and asking
     * again goes on with that key.
     */
    setUp: () => Promise<string>,
    /** Gives the device the recovery key the user saved. Rejects with WrongRecoveryKey when it is not the account's. */
    enter: (recoveryKey: string) => Promise<void>,
}

export class WrongRecoveryKey extends Error {
    constructor() {
        super('This is not the recovery key of the account')
    }
}

export class RecoveryIsSetUp extends Error {
    constructor() {
        super('The account has a recovery key or a backup of keys already')
    }
}

export class RecoveryUnfinished extends Error {
    constructor(readonly recoveryKey: string, cause: unknown) {
        super('The recovery key was made, and setting it up was not finished', { cause })
    }
}

type RecoveryKey = Uint8Array<ArrayBuffer>
/** The key the SDK may be given now, and whether it is the one a description of a key is of. */
type Held = { key: RecoveryKey, isOf: (description: SecretStorageKeyDescription) => Promise<boolean> }
const held = new WeakMap<CryptoCallbacks, Held>()
/** The key of a setting up that was not finished, which is kept while the client lives so the next try uses it. */
const unfinished = new WeakMap<MatrixClient, GeneratedSecretStorageKey>()
const BACKUP_SECRET = 'm.megolm_backup.v1'
const DEFAULT_KEY = 'm.secret_storage.default_key'

/**
 * The recovery of a client's account, as a component shows it. What is written in an encrypted
 * room is read with keys that each device keeps for itself. Three things on the homeserver let a
 * new device have them, all of Matrix: the user's identity, by which their devices are known as
 * theirs, a backup of the keys that the homeserver cannot read, and a locked store that holds
 * what opens both. The recovery key is what unlocks that store. `setUp` makes all three and
 * `enter` opens them on a new device, which then fetches the keys of the earlier messages, and
 * the SDK reads those messages anew as their keys come. Neither ever replaces what an account
 * has: an identity, a store or a backup that is there is another device's or another client's,
 * and making a new one would lose what it holds. `enter` also finishes a setting up that stopped
 * halfway, once it holds the right key. Where a device stands is read from what the client
 * holds, at every sync and when the SDK says something of it has changed, and the homeserver is
 * asked nothing for it. Only `setUp` asks, right before it makes anything.
 */
export function watchRecovery(client: MatrixClient): WatchedRecovery {
    const { ClientEvent } = loadedChatSdk()
    const changes = client.getCrypto() ? changesOf(loadedChatCryptoSdk().CryptoEvent) : []
    const watchers = new Set<() => void>()
    let shown: Recovery = 'LOOKING'
    let looks = 0

    const look = async () => {
        const looking = ++looks
        const found = await recoveryOf(client).catch(() => shown)
        if (looking !== looks || found === shown) return
        shown = found
        watchers.forEach(watcher => watcher())
    }
    const lookAgain = () => void look()
    const withKey = async <Given>(key: RecoveryKey, work: () => Promise<Given>): Promise<Given> => {
        held.set(client.cryptoCallbacks, { key, isOf: description => client.secretStorage.checkKey(key, description) })
        try {
            return await work()
        } finally {
            held.delete(client.cryptoCallbacks)
            await look()
        }
    }
    const encryption = () => {
        const crypto = client.getCrypto()
        if (!crypto) throw new Error('The client has no encryption')
        return crypto
    }

    return {
        subscribe: onChange => {
            if (watchers.size === 0) {
                // eslint-disable-next-line no-sync -- The event of the client's sync, and no synchronous call.
                client.on(ClientEvent.Sync, lookAgain)
                changes.forEach(change => client.on(change, lookAgain))
                lookAgain()
            }
            watchers.add(onChange)
            return () => {
                watchers.delete(onChange)
                if (watchers.size > 0) return
                // eslint-disable-next-line no-sync -- As above.
                client.off(ClientEvent.Sync, lookAgain)
                changes.forEach(change => client.off(change, lookAgain))
            }
        },
        read: () => shown,
        setUp: async () => {
            const crypto = encryption()
            // What is shown may be old: another device may have set the account up since. So the
            // homeserver is asked what the account has now, before anything is made.
            const [onHomeserver, stored, backup, backupKey, hasIdentity] = await Promise.all([
                defaultKeyOnHomeserver(client),
                client.secretStorage.getKey(),
                hasBackupOnHomeserver(client),
                crypto.getSessionBackupPrivateKey(),
                crypto.userHasCrossSigningKeys(undefined, true),
            ])
            const before = unfinished.get(client)
            const isOwn = before !== undefined && stored !== null && stored[0] === onHomeserver
                && await client.secretStorage.checkKey(before.privateKey, stored[1])
            // An identity made elsewhere would be replaced by one made here, which the user's
            // other devices would not know.
            const isIdentityOfAnother = hasIdentity && !await holdsIdentity(crypto)
            if (onHomeserver !== null && !isOwn || stored && !isOwn || backup && !backupKey || isIdentityOfAnother) {
                unfinished.delete(client)
                await look()
                throw new RecoveryIsSetUp()
            }
            const made = before ?? await crypto.createRecoveryKeyFromPassphrase()
            const { encodedPrivateKey: asText } = made
            if (!asText) throw new Error('The recovery key could not be written as text')
            unfinished.set(client, made)
            await withKey(made.privateKey, async () => {
                // The homeserver takes the first identity of an account without asking who is there again.
                await crypto.bootstrapCrossSigning({ authUploadDeviceSigningKeys: async upload => void await upload(null) })
                await crypto.bootstrapSecretStorage({ createSecretStorageKey: () => Promise.resolve(made) })
                if (!backup) await crypto.resetKeyBackup()
            }).catch((error: unknown) => {
                throw new RecoveryUnfinished(asText, error)
            })
            unfinished.delete(client)
            return asText
        },
        enter: async recoveryKey => {
            const crypto = encryption()
            const key = await keyOf(client, recoveryKey)
            await withKey(key, async () => {
                // What the store holds is taken out of it. What it lacks is a setting up that
                // stopped halfway, which is finished from here with what this device holds: its
                // own identity is put in the store, and a backup is made where there is none. An
                // identity is never made in place of one, and a backup never replaced: either
                // would lose what the user's other devices hold.
                const { privateKeysInSecretStorage } = await crypto.getCrossSigningStatus()
                if (privateKeysInSecretStorage) await crypto.bootstrapCrossSigning({})
                if (await client.secretStorage.isStored(BACKUP_SECRET)) {
                    await crypto.loadSessionBackupPrivateKeyFromSecretStorage()
                    await crypto.checkKeyBackupAndEnable()
                    await crypto.restoreKeyBackup()
                } else if (!await hasBackupOnHomeserver(client)) {
                    await crypto.resetKeyBackup()
                }
                // Puts in the store what this device holds and the store lacks, and makes nothing.
                await crypto.bootstrapSecretStorage({})
            })
        },
    }
}

/**
 * What a client is made with so the SDK can ask for the recovery key. The key is held only while
 * `setUp` or `enter` runs, and is given only for the key of the store that it is.
 */
export function recoveryCallbacks(): CryptoCallbacks {
    const callbacks: CryptoCallbacks = {
        getSecretStorageKey: async ({ keys }) => {
            const holding = held.get(callbacks)
            if (!holding) return null
            for (const [keyId, description] of Object.entries(keys)) {
                if (await holding.isOf(description)) return [keyId, holding.key]
            }
            return null
        },
    }
    return callbacks
}

/** What the SDK tells of that may change where a device stands. */
function changesOf(CryptoEvent: ChatCryptoSdk['CryptoEvent']) {
    return [
        CryptoEvent.KeysChanged,
        CryptoEvent.DevicesUpdated,
        CryptoEvent.UserTrustStatusChanged,
        CryptoEvent.KeyBackupStatus,
        CryptoEvent.KeyBackupDecryptionKeyCached,
    ] as const
}

/**
 * The id of the key the account's store is locked with, as the homeserver has it now, and null
 * where it has none. The client's own word for it is only as new as its last sync.
 */
async function defaultKeyOnHomeserver(client: MatrixClient): Promise<string | null> {
    const { Method, MatrixError } = loadedChatSdk()
    const path = `/user/${encodeURIComponent(client.getSafeUserId())}/account_data/${DEFAULT_KEY}`
    const noted = await client.http.authedRequest<{ key?: unknown }>(Method.Get, path).catch((error: unknown) => {
        if (error instanceof MatrixError && error.httpStatus === 404) return null
        throw error
    })
    return typeof noted?.key === 'string' ? noted.key : null
}

/**
 * Whether the homeserver has a backup of the account's keys now. The SDK answers that from what
 * it found the first time it looked, and making a backup deletes every one that is there, so
 * the homeserver itself is asked before one is made. It rejects where the homeserver does not
 * say, so nothing is made on a guess.
 */
async function hasBackupOnHomeserver(client: MatrixClient): Promise<boolean> {
    const { Method, MatrixError } = loadedChatSdk()
    return client.http.authedRequest(Method.Get, '/room_keys/version').then(() => true, (error: unknown) => {
        if (error instanceof MatrixError && error.httpStatus === 404) return false
        throw error
    })
}

/** Where the device stands, from what the client holds: the homeserver is asked nothing. */
async function recoveryOf(client: MatrixClient): Promise<Recovery> {
    if (!client.isInitialSyncComplete()) return 'LOOKING'
    const hasRecoveryKey = await client.secretStorage.hasKey()
    if (!hasRecoveryKey && !client.getRooms().some(room => room.hasEncryptionStateEvent())) return 'NOTHING_ENCRYPTED'
    const crypto = client.getCrypto()
    if (!crypto) return 'UNAVAILABLE'
    const [identity, device, backupKey] = await Promise.all([
        crypto.getCrossSigningStatus(),
        crypto.getDeviceVerificationStatus(client.getSafeUserId(), client.getDeviceId() ?? ''),
        crypto.getSessionBackupPrivateKey(),
    ])
    if (hasRecoveryKey) return device?.crossSigningVerified && backupKey ? 'READY' : 'KEY_NEEDED'
    // An identity this device made itself, whose setting up was not finished, is finished from here.
    return identity.publicKeysOnDevice && !await holdsIdentity(crypto) ? 'IDENTITY_WITHOUT_KEY' : 'NOT_SET_UP'
}

/** Whether the device holds the secret part of the user's identity, which the device that made it does. */
async function holdsIdentity(crypto: CryptoApi): Promise<boolean> {
    const { masterKey, selfSigningKey, userSigningKey } = (await crypto.getCrossSigningStatus()).privateKeysCachedLocally
    return masterKey && selfSigningKey && userSigningKey
}

/** The key a text the user wrote is, where it is the recovery key of the account. */
async function keyOf(client: MatrixClient, recoveryKey: string): Promise<RecoveryKey> {
    const { decodeRecoveryKey } = loadedChatCryptoSdk()
    const [, description] = await client.secretStorage.getKey() ?? []
    try {
        const key = decodeRecoveryKey(recoveryKey.trim())
        if (description && await client.secretStorage.checkKey(key, description)) return key
    } catch {
        // What cannot be read as a key is not the key.
    }
    throw new WrongRecoveryKey()
}
