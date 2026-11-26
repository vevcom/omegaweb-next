import { fakeChatBrowser, stopSyncedChatClients, syncedChatClient, tameChatSdk } from 'tests/chatSessionBrowser'
import { RecoveryIsSetUp, RecoveryUnfinished, WrongRecoveryKey, watchRecovery } from '@/lib/chatSession/recovery'
import { NO_KEY_SHOWN, keyShownAfter } from '@/components/Chat/Recovery/keyShown'
import { forgetSession, storeSession } from '@/lib/chatSession/storage'
import { afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import type { Recovery } from '@/lib/chatSession/recovery'

const KARI = '@kari:chat.test'
const CLIENT = '/_matrix/client/v3'
const SYNC = `${CLIENT}/sync`
const ACCOUNT_DATA = `${CLIENT}/user/${encodeURIComponent(KARI)}/account_data/`
const ofKari = { userId: KARI, deviceId: 'KARISDEVICE1', accessToken: 'access-0', refreshToken: 'refresh-0' }

const NOT_FOUND = { status: 404, body: { errcode: 'M_NOT_FOUND', error: 'Not found' } }
/** Whether something asked of the homeserver changes anything there. Asking for keys is a POST that does not. */
const isNoQuestion = (asked: string) => !asked.startsWith('GET ') && !asked.endsWith('/keys/query')
const settled = () => new Promise(resolve => setTimeout(resolve, 200))

const ENCRYPTION = {
    event_id: '$encryption',
    sender: KARI,
    type: 'm.room.encryption',
    state_key: '',
    content: { algorithm: 'm.megolm.v1.aes-sha2' },
    origin_server_ts: 1000,
}

beforeAll(() => tameChatSdk(jest.spyOn))
afterEach(stopSyncedChatClients)

type Signed = { signatures?: Record<string, Record<string, string>> }
type Identity = Record<'master_key' | 'self_signing_key' | 'user_signing_key', Signed & { keys: Record<string, string> }>

/**
 * A browser of Kari's on a homeserver that keeps what recovery is made of, as Synapse does: what
 * is noted in the account, which it tells every device of, the identity and the signatures the
 * devices give each other, and the one backup of keys.
 */
function browserWithRecovery() {
    const fake = fakeChatBrowser()
    const noted = new Map<string, object>()
    const devices: Record<string, Signed> = {}
    let identity: Identity | null = null
    let backup: object | null = null
    let waiting: ((answer: { body: object }) => void) | null = null
    let untold: object[] = []
    let tellings = 0
    let backupsMade = 0
    const refusing = { backups: false, sayingOfBackups: false, noting: null as string | null }
    const rooms = { joined: { '!hemmelig:chat.test': { state: { events: [ENCRYPTION] } } } as object }

    let devicesChanged: string[] = []
    let latest = 'first'
    const news = () => {
        latest = `news-${++tellings}`
        return {
            body: {
                next_batch: latest,
                account_data: { events: untold.splice(0) },
                device_lists: { changed: devicesChanged.splice(0) },
            },
        }
    }
    const wake = () => {
        const answerTheOneThatWaits = waiting
        waiting = null
        answerTheOneThatWaits?.(news())
    }
    /** The homeserver tells every device of the user when the keys or signatures of one have changed. */
    const tellOfDevices = () => {
        devicesChanged = [KARI]
        wake()
    }
    const everythingNoted = () => Array.from(noted, ([type, content]) => ({ type, content }))
    fake.answer(SYNC, call => {
        const since = call.url.searchParams.get('since')
        if (since === null) {
            untold = []
            latest = 'first'
            const accountData = { events: everythingNoted() }
            return { body: { next_batch: latest, account_data: accountData, rooms: { join: rooms.joined } } }
        }
        // A client that asks on from an earlier answer, as one loaded anew does, is told what it missed.
        if (since !== latest) untold = everythingNoted()
        return untold.length + devicesChanged.length > 0 ? news() : new Promise(resolve => {
            waiting = resolve
        })
    })
    const tell = (type: string, content: object) => {
        noted.set(type, content)
        untold.push({ type, content })
        wake()
    }
    fake.answerUnder(ACCOUNT_DATA, call => {
        const type = decodeURIComponent(call.url.pathname.slice(ACCOUNT_DATA.length))
        if (call.method === 'GET') return noted.has(type) ? { body: noted.get(type) } : NOT_FOUND
        if (type === refusing.noting) return { status: 403, body: { errcode: 'M_FORBIDDEN', error: 'Nei' } }
        tell(type, call.json as object)
        return { body: {} }
    })
    fake.answer(`${CLIENT}/keys/upload`, call => {
        const { device_keys: uploaded } = call.json as { device_keys?: Signed & { device_id: string } }
        if (uploaded) devices[uploaded.device_id] = uploaded
        return { body: { one_time_key_counts: { signed_curve25519: 50 } } }
    })
    fake.answer(`${CLIENT}/keys/device_signing/upload`, call => {
        identity = call.json as Identity
        tellOfDevices()
        return { body: {} }
    })
    fake.answer(`${CLIENT}/keys/signatures/upload`, call => {
        const signed = (call.json as Record<string, Record<string, Signed>>)[KARI]
        Object.entries(signed).forEach(([id, { signatures }]) => {
            const of = devices[id] ?? Object.values(identity ?? {}).find(key => Object.values(key.keys).includes(id))
            if (of) of.signatures = { [KARI]: { ...of.signatures?.[KARI], ...signatures?.[KARI] } }
        })
        tellOfDevices()
        return { body: {} }
    })
    fake.answer(`${CLIENT}/keys/claim`, () => ({ body: { one_time_keys: {} } }))
    fake.answer(`${CLIENT}/keys/query`, () => ({
        body: {
            device_keys: { [KARI]: devices },
            ...identity && {
                master_keys: { [KARI]: identity.master_key },
                self_signing_keys: { [KARI]: identity.self_signing_key },
                user_signing_keys: { [KARI]: identity.user_signing_key },
            },
        },
    }))
    fake.answerUnder(`${CLIENT}/room_keys/version`, call => {
        if (call.method !== 'GET' && refusing.backups) return { status: 403, body: { errcode: 'M_FORBIDDEN', error: 'Nei' } }
        if (refusing.sayingOfBackups) return { status: 500, body: { errcode: 'M_UNKNOWN', error: 'Nede' } }
        if (call.method === 'DELETE') backup = null
        else if (call.method !== 'GET') backup = { ...call.json as object, version: `${++backupsMade}`, count: 0, etag: '0' }
        if (call.method === 'POST') return { body: { version: `${backupsMade}` } }
        return backup ? { body: backup } : NOT_FOUND
    })
    const keysKept = (call: { method: string }) => (call.method === 'GET' ? { rooms: {} } : { count: 0, etag: '1' })
    fake.answerUnder(`${CLIENT}/room_keys/keys`, call => ({ body: keysKept(call) }))

    return {
        fake,
        /** A device of Kari's with the client running, and where it stands with her recovery key once that is known. */
        device: async (deviceId: string) => {
            storeSession(fake.browser, { ...ofKari, deviceId })
            const client = await syncedChatClient(fake.browser, KARI)
            const watched = watchRecovery(client)
            const seen: Recovery[] = []
            watched.subscribe(() => seen.push(watched.read()))
            const stands = async () => {
                for (let waits = 0; waits < 100 && watched.read() === 'LOOKING'; waits++) {
                    await new Promise(resolve => setTimeout(resolve, 20))
                }
                return watched.read()
            }
            /** Resolves once the device stands so, which it may only after the sync that follows the first. */
            const comesToStand = async (wanted: Recovery) => {
                for (let waits = 0; waits < 250 && watched.read() !== wanted; waits++) {
                    await new Promise(resolve => setTimeout(resolve, 20))
                }
                return watched.read()
            }
            return { client, watched, seen, stands, comesToStand }
        },
        /** Signs the browser out, which forgets the device and its keys. */
        signOut: async () => {
            await stopSyncedChatClients()
            await forgetSession(fake.browser)
        },
        noted,
        tell,
        refusing,
        backup: () => backup,
        backupsMade: () => backupsMade,
        /** Gives the account a backup of keys, as a client that sets up no recovery key leaves it. */
        leaveBackup: (left: object | null) => {
            backup = left
        },
        /** What was asked of the homeserver besides the sync, as the method and the path. */
        asked: () => fake.calls
            .filter(call => call.url.pathname !== SYNC)
            .map(call => `${call.method} ${call.url.pathname}`),
        rooms,
    }
}

describe('the recovery key', () => {
    test('is made at first use, given once as a text, and leaves the device ready', async () => {
        const first = await browserWithRecovery().device('KARISDEVICE1')
        expect(await first.stands()).toBe('NOT_SET_UP')

        const recoveryKey = await first.watched.setUp()

        expect(recoveryKey).toMatch(/^([A-Za-z1-9]{4} ){11}[A-Za-z1-9]{4}$/)
        await settled()
        expect(first.watched.read()).toBe('READY')
        expect(first.seen.at(-1)).toBe('READY')
    })

    test('is not spoken of to one who is in no encrypted room, as on a homeserver that encrypts nothing', async () => {
        const browser = browserWithRecovery()
        browser.rooms.joined = { '!åpent:chat.test': { state: { events: [] } } }

        const first = await browser.device('KARISDEVICE1')

        expect(await first.stands()).toBe('NOTHING_ENCRYPTED')
    })

    test('is nowhere the homeserver can read it, and is not kept in the browser', async () => {
        const browser = browserWithRecovery()
        const first = await browser.device('KARISDEVICE1')
        await first.stands()

        const recoveryKey = await first.watched.setUp()

        const everythingKept = JSON.stringify([browser.fake.calls.map(call => call.json), Array.from(browser.fake.kept)])
        expect(everythingKept).not.toContain(recoveryKey)
        expect(everythingKept).not.toContain(recoveryKey.replaceAll(' ', ''))
        expect(Array.from(browser.noted.keys())).toEqual(expect.arrayContaining([
            'm.secret_storage.default_key',
            'm.cross_signing.master',
            'm.megolm_backup.v1',
        ]))
    })

    test('is asked for in a browser that signs in after it was made, which is ready once it is given it', async () => {
        const browser = browserWithRecovery()
        const first = await browser.device('KARISDEVICE1')
        await first.stands()
        const recoveryKey = await first.watched.setUp()
        await browser.signOut()

        const second = await browser.device('KARISDEVICE2')
        expect(await second.stands()).toBe('KEY_NEEDED')

        await second.watched.enter(` ${recoveryKey}\n`)
        await settled()

        expect(second.watched.read()).toBe('READY')
        const status = await second.client.getCrypto()?.getDeviceVerificationStatus(KARI, 'KARISDEVICE2')
        expect(status?.crossSigningVerified).toBe(true)
        expect(await second.client.getCrypto()?.getSessionBackupPrivateKey()).not.toBeNull()
    })

    test('is refused when it is another key or no key, and the device is left asking for it', async () => {
        const browser = browserWithRecovery()
        const first = await browser.device('KARISDEVICE1')
        await first.stands()
        await first.watched.setUp()
        const another = await first.client.getCrypto()?.createRecoveryKeyFromPassphrase()
        await browser.signOut()
        const second = await browser.device('KARISDEVICE2')
        await second.stands()
        const uploads = () => browser.fake.callsTo(`${CLIENT}/keys/signatures/upload`).length
        const before = uploads()

        for (const wrong of [another?.encodedPrivateKey ?? '', 'ikke en nøkkel', '']) {
            await expect(second.watched.enter(wrong)).rejects.toBeInstanceOf(WrongRecoveryKey)
        }

        expect(second.watched.read()).toBe('KEY_NEEDED')
        expect(uploads()).toBe(before)
    })

    test('is given all the same when setting it up stops halfway, and asking again goes on with that key', async () => {
        const browser = browserWithRecovery()
        const first = await browser.device('KARISDEVICE1')
        await first.stands()
        browser.refusing.backups = true

        const stopped: unknown = await first.watched.setUp().catch((error: unknown) => error)

        expect(stopped).toBeInstanceOf(RecoveryUnfinished)
        const recoveryKey = stopped instanceof RecoveryUnfinished ? stopped.recoveryKey : ''
        expect(recoveryKey).toMatch(/^([A-Za-z1-9]{4} ){11}[A-Za-z1-9]{4}$/)
        expect(browser.noted.has('m.secret_storage.default_key')).toBe(true)
        await settled()
        expect(first.watched.read()).toBe('KEY_NEEDED')

        browser.refusing.backups = false
        await expect(first.watched.setUp()).resolves.toBe(recoveryKey)
        await settled()

        expect(first.watched.read()).toBe('READY')
        expect(Array.from(browser.noted.keys()).filter(type => type.startsWith('m.secret_storage.key.'))).toHaveLength(1)
        await browser.signOut()
        const second = await browser.device('KARISDEVICE2')
        await second.stands()
        await second.watched.enter(recoveryKey)
        await settled()
        expect(second.watched.read()).toBe('READY')
    })

    test('keeps the backup it made when a later step stopped, and makes no second one at the next try', async () => {
        const browser = browserWithRecovery()
        const first = await browser.device('KARISDEVICE1')
        await first.stands()
        browser.refusing.noting = 'm.megolm_backup.v1'
        await expect(first.watched.setUp()).rejects.toBeInstanceOf(RecoveryUnfinished)
        const backups = () => browser.asked().filter(asked => /^(POST|DELETE) .*room_keys\/version/.test(asked))
        expect(backups()).toHaveLength(1)

        browser.refusing.noting = null
        await first.watched.setUp()
        await settled()

        expect(backups()).toHaveLength(1)
        expect(first.watched.read()).toBe('READY')
    })

    test('is given to the SDK only for the key of the store that it is', async () => {
        const browser = browserWithRecovery()
        const first = await browser.device('KARISDEVICE1')
        await first.stands()
        const recoveryKey = await first.watched.setUp()
        const another = await first.client.getCrypto()?.createRecoveryKeyFromPassphrase()
        if (!another) throw new Error('No key was made')
        const store = first.client.secretStorage
        const ofAnother = await store.addKey('m.secret_storage.v1.aes-hmac-sha2', { key: another.privateKey })
        await browser.signOut()
        const second = await browser.device('KARISDEVICE2')
        await second.stands()
        const crypto = second.client.getCrypto()
        if (!crypto) throw new Error('The device has no encryption')
        const asked = { keys: { [ofAnother.keyId]: ofAnother.keyInfo } }
        const ask = () => second.client.cryptoCallbacks.getSecretStorageKey?.(asked, 'x')
        let givenWhileHeld: unknown = 'NOT_ASKED'
        const bootstrap = crypto.bootstrapCrossSigning.bind(crypto)
        jest.spyOn(crypto, 'bootstrapCrossSigning').mockImplementation(async options => {
            givenWhileHeld = await ask()
            await bootstrap(options)
        })

        await second.watched.enter(recoveryKey)

        expect(givenWhileHeld).toBeNull()
        expect(await ask()).toBeNull()
    })

    test('is not made for an account that has a backup of keys already, which is left as it was', async () => {
        const browser = browserWithRecovery()
        const authData = { public_key: 'A'.repeat(43) }
        const left = { algorithm: 'm.megolm_backup.v1.curve25519-aes-sha2', auth_data: authData, version: '7' }
        browser.leaveBackup(left)
        const first = await browser.device('KARISDEVICE1')
        expect(await first.stands()).toBe('NOT_SET_UP')
        const before = browser.asked().length

        await expect(first.watched.setUp()).rejects.toBeInstanceOf(RecoveryIsSetUp)

        expect(browser.backup()).toBe(left)
        expect(browser.asked().slice(before).filter(isNoQuestion)).toEqual([])
    })

    test('is not made over a backup another client made after this one last looked, nor on a guess', async () => {
        const browser = browserWithRecovery()
        const first = await browser.device('KARISDEVICE1')
        expect(await first.stands()).toBe('NOT_SET_UP')
        // The SDK has looked and found none, and remembers that.
        await expect(first.client.getCrypto()?.getKeyBackupInfo()).resolves.toBeNull()
        const authData = { public_key: 'A'.repeat(43) }
        const left = { algorithm: 'm.megolm_backup.v1.curve25519-aes-sha2', auth_data: authData, version: '7' }
        browser.leaveBackup(left)

        await expect(first.watched.setUp()).rejects.toBeInstanceOf(RecoveryIsSetUp)
        expect(browser.backup()).toBe(left)

        browser.leaveBackup(null)
        browser.refusing.sayingOfBackups = true
        await expect(first.watched.setUp()).rejects.not.toBeInstanceOf(RecoveryIsSetUp)
        expect(browser.noted.has('m.secret_storage.default_key')).toBe(false)
    })

    test('is not made when another device has made one since this one last heard', async () => {
        const browser = browserWithRecovery()
        const first = await browser.device('KARISDEVICE1')
        expect(await first.stands()).toBe('NOT_SET_UP')
        // The homeserver has it, and no sync has told this device yet.
        browser.noted.set('m.secret_storage.default_key', { key: 'another-devices' })
        const before = browser.asked().length

        await expect(first.watched.setUp()).rejects.toBeInstanceOf(RecoveryIsSetUp)

        expect(first.watched.read()).toBe('NOT_SET_UP')
        expect(browser.asked().slice(before).filter(isNoQuestion)).toEqual([])
    })

    test('asks the homeserver nothing to say where a device stands, however many syncs come', async () => {
        const browser = browserWithRecovery()
        const first = await browser.device('KARISDEVICE1')
        await first.stands()
        await first.watched.setUp()
        await settled()
        const before = browser.asked().length

        for (const news of ['en', 'to', 'tre']) {
            browser.tell('no.omega.news', { news })
            await settled()
        }

        expect(first.watched.read()).toBe('READY')
        // The SDK tops up the keys others start a conversation with by itself, and that is all.
        expect(browser.asked().slice(before).filter(asked => !asked.endsWith('/keys/upload'))).toEqual([])
    })

    test('is neither asked for nor made where another client gave the account an identity and no key', async () => {
        const browser = browserWithRecovery()
        const elsewhere = await browser.device('KARISDEVICE1')
        await elsewhere.stands()
        const crypto = elsewhere.client.getCrypto()
        await crypto?.bootstrapCrossSigning({ authUploadDeviceSigningKeys: async upload => void await upload(null) })
        await browser.signOut()

        const here = await browser.device('KARISDEVICE2')

        expect(await here.stands()).toBe('IDENTITY_WITHOUT_KEY')
    })

    test('never makes a new identity or replaces a backup when it is entered and the store holds neither', async () => {
        const browser = browserWithRecovery()
        const elsewhere = await browser.device('KARISDEVICE1')
        await elsewhere.stands()
        const crypto = elsewhere.client.getCrypto()
        const made = await crypto?.createRecoveryKeyFromPassphrase()
        if (!made?.encodedPrivateKey) throw new Error('No key was made')
        // A store with a key and nothing in it, as a client that stopped there leaves it.
        const store = elsewhere.client.secretStorage
        const { keyId } = await store.addKey('m.secret_storage.v1.aes-hmac-sha2', { key: made.privateKey })
        await store.setDefaultKeyId(keyId)
        await browser.signOut()
        const here = await browser.device('KARISDEVICE2')
        expect(await here.stands()).toBe('KEY_NEEDED')

        const authData = { public_key: 'A'.repeat(43) }
        const left = { algorithm: 'm.megolm_backup.v1.curve25519-aes-sha2', auth_data: authData, version: '7' }
        browser.leaveBackup(left)

        await here.watched.enter(made.encodedPrivateKey)

        expect(browser.fake.callsTo(`${CLIENT}/keys/device_signing/upload`)).toEqual([])
        expect([browser.backup(), browser.backupsMade()]).toEqual([left, 0])
    })

    test('is not made over an identity that was made elsewhere, which is left as it was', async () => {
        const browser = browserWithRecovery()
        const elsewhere = await browser.device('KARISDEVICE1')
        await elsewhere.stands()
        const crypto = elsewhere.client.getCrypto()
        await crypto?.bootstrapCrossSigning({ authUploadDeviceSigningKeys: async upload => void await upload(null) })
        await browser.signOut()
        const here = await browser.device('KARISDEVICE2')
        const identities = () => browser.fake.callsTo(`${CLIENT}/keys/device_signing/upload`).length
        const before = identities()

        await expect(here.watched.setUp()).rejects.toBeInstanceOf(RecoveryIsSetUp)

        expect(identities()).toBe(before)
        expect(browser.noted.has('m.secret_storage.default_key')).toBe(false)
        expect(await here.stands()).toBe('IDENTITY_WITHOUT_KEY')
    })

    test('finishes a setting up that stopped halfway when it is entered after the page was loaded anew', async () => {
        const browser = browserWithRecovery()
        const first = await browser.device('KARISDEVICE1')
        await first.stands()
        browser.refusing.backups = true
        const stopped: unknown = await first.watched.setUp().catch((error: unknown) => error)
        const recoveryKey = stopped instanceof RecoveryUnfinished ? stopped.recoveryKey : ''
        await stopSyncedChatClients()
        browser.refusing.backups = false

        const again = await browser.device('KARISDEVICE1')
        expect(await again.comesToStand('KEY_NEEDED')).toBe('KEY_NEEDED')
        await expect(again.watched.setUp()).rejects.toBeInstanceOf(RecoveryIsSetUp)
        await again.watched.enter(recoveryKey)
        await settled()

        expect(again.watched.read()).toBe('READY')
        expect(browser.backupsMade()).toBe(1)
        expect(browser.fake.callsTo(`${CLIENT}/keys/device_signing/upload`)).toHaveLength(1)
    })
})

describe('the key the page shows', () => {
    const shown = { made: { recoveryKey: 'EsTc 1234', isSetUp: false }, isLetGo: false }

    test('is the one whose setting up stopped, with that it is not finished', () => {
        expect(keyShownAfter(NO_KEY_SHOWN, { error: new RecoveryUnfinished('EsTc 1234', null) })).toEqual(shown)
        expect(keyShownAfter(shown, { recoveryKey: 'EsTc 1234' }).made).toEqual({ recoveryKey: 'EsTc 1234', isSetUp: true })
    })

    test('is taken away, and said to be no key to keep, when the account turns out to have another\'s key', () => {
        expect(keyShownAfter(shown, { error: new RecoveryIsSetUp() })).toEqual({ made: null, isLetGo: true })
        expect(keyShownAfter(NO_KEY_SHOWN, { error: new RecoveryIsSetUp() })).toEqual(NO_KEY_SHOWN)
    })

    test('stays when finishing fails for another reason', () => {
        expect(keyShownAfter(shown, { error: new Error('No contact') })).toBe(shown)
    })
})
