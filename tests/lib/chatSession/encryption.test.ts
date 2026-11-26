import {
    configFor,
    fakeChatBrowser,
    newsTaken,
    REDIRECT_URI,
    stopSyncedChatClients,
    syncedChatClient,
    tameChatSdk,
} from 'tests/chatSessionBrowser'
import { runChatSession } from '@/lib/chatSession/run'
import { storeSession } from '@/lib/chatSession/storage'
import { watchRoomTimeline } from '@/lib/chatSession/timeline'
import { MatrixClient } from 'matrix-js-sdk'
import { afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import type { ChatCall } from 'tests/chatSessionBrowser'

const KARI = '@kari:chat.test'
const OLA = '@ola:chat.test'
const ROOM = '!hemmelig:chat.test'
const OF_ROOM = `/_matrix/client/v3/rooms/${encodeURIComponent(ROOM)}`
const SEND_ENCRYPTED = `${OF_ROOM}/send/m.room.encrypted/`
const SEND_PLAIN = `${OF_ROOM}/send/m.room.message/`
const MEDIA = '/_matrix/client/v1/media'
const UPLOAD = '/_matrix/media/v3/upload'
const ofKari = { userId: KARI, deviceId: 'KARISDEVICE1', accessToken: 'access-0', refreshToken: 'refresh-0' }

beforeAll(() => tameChatSdk(jest.spyOn))
afterEach(stopSyncedChatClients)

const stateEvent = (type: string, sender: string, content: object, stateKey = '') =>
    ({ event_id: `$${type}-${stateKey}`, sender, type, state_key: stateKey, content, origin_server_ts: 1000 })
const members = [
    stateEvent('m.room.member', KARI, { membership: 'join', displayname: 'Kari' }, KARI),
    stateEvent('m.room.member', OLA, { membership: 'join', displayname: 'Ola' }, OLA),
]
const encryptedRoom = (timeline: object[] = []) => ({
    state: {
        events: [
            stateEvent('m.room.create', '@the-maker:chat.test', { room_version: '12' }),
            stateEvent('m.room.encryption', '@the-maker:chat.test', { algorithm: 'm.megolm.v1.aes-sha2' }),
            ...members,
        ],
    },
    timeline: { events: timeline, prev_batch: 'before-the-sync' },
})
const asEvent = (call: ChatCall, id: string) =>
    ({ event_id: id, sender: KARI, type: 'm.room.encrypted', content: call.json, origin_server_ts: 2000 })

const settled = (ms = 100) => newsTaken().then(() => new Promise(resolve => setTimeout(resolve, ms)))

/** Kari's device in an encrypted room with Ola, on a homeserver that takes what is sent and gives each event an id. */
async function inEncryptedRoom(session = ofKari, timeline: object[] = []) {
    const fake = fakeChatBrowser()
    storeSession(fake.browser, session)
    fake.chat.rooms = { join: { [ROOM]: encryptedRoom(timeline) } }
    fake.answer(`${OF_ROOM}/members`, () => ({ body: { chunk: members } }))
    let taken = 0
    fake.answerUnder(`${OF_ROOM}/send/`, () => ({ body: { event_id: `$taken-${++taken}` } }))
    const { tell } = fake.tellingOfNews()
    const client = await syncedChatClient(fake.browser, KARI)
    const room = client.getRoom(ROOM)
    if (!room) throw new Error('The client was not told of the room')
    const watched = watchRoomTimeline(client, room)
    watched.subscribe(() => watched.read())
    const sent = (pathnameStart: string) => fake.calls.filter(call => call.url.pathname.startsWith(pathnameStart))
    return {
        fake,
        client,
        room,
        watched,
        /** What the homeserver was sent, encrypted and not. */
        encrypted: () => sent(SEND_ENCRYPTED).map(call => call.json as Record<string, unknown>),
        plain: () => sent(SEND_PLAIN),
        tell,
        lines: () => watched.read().lines.map(line => (line.kind === 'MESSAGE' ? line.text : line.what)),
        /** The homeserver sends what it was sent back to the device, as an event of the room. */
        tellOf: (call: ChatCall, id: string) => tell({
            join: { [ROOM]: { timeline: { events: [asEvent(call, id)] } } },
        }),
        sent,
    }
}

describe('a message written in an encrypted room', () => {
    test('is sent encrypted, and the room says that it is encrypted', async () => {
        const { watched, encrypted, plain } = await inEncryptedRoom()
        expect(watched.read().isEncrypted).toBe(true)

        watched.send('Dette skal ingen andre lese')
        await settled()

        expect(plain()).toEqual([])
        expect(encrypted()).toHaveLength(1)
        expect(encrypted()[0]).toMatchObject({ algorithm: 'm.megolm.v1.aes-sha2', ciphertext: expect.any(String) })
        expect(JSON.stringify(encrypted())).not.toContain('ingen andre')
    })

    test('says whom it mentions beside the encrypted part, and nothing there when it mentions nobody', async () => {
        const { watched, encrypted } = await inEncryptedRoom()

        watched.send('Hei @Ola', { mentions: { userIds: [OLA], room: false } })
        watched.send('Hei alle')
        await settled()

        expect(encrypted().map(content => content['m.mentions'])).toEqual([{ user_ids: [OLA] }, undefined])
        expect(encrypted().map(content => Object.keys(content).toSorted())).toEqual([
            ['algorithm', 'ciphertext', 'device_id', 'm.mentions', 'sender_key', 'session_id'],
            ['algorithm', 'ciphertext', 'device_id', 'sender_key', 'session_id'],
        ])
    })

    test('says beside the encrypted part whom a new text adds, and that it is an edit', async () => {
        const { watched, encrypted, sent, tellOf, lines } = await inEncryptedRoom()
        watched.send('Hei')
        await settled()
        tellOf(sent(SEND_ENCRYPTED)[0], '$taken-1')
        await settled()
        expect(lines()).toEqual(['Hei'])

        await watched.edit('$taken-1', 'Hei @Ola', { userIds: [OLA], room: false })

        expect(encrypted()[1]).toMatchObject({
            'm.mentions': { user_ids: [OLA] },
            'm.relates_to': { rel_type: 'm.replace', event_id: '$taken-1' },
        })
    })

    test('is sent again with whom it mentions when it was not taken the first time', async () => {
        const { fake, watched, encrypted } = await inEncryptedRoom()
        fake.answerUnder(`${OF_ROOM}/send/`, () => ({ status: 403, body: { errcode: 'M_FORBIDDEN', error: 'Nei' } }))
        watched.send('Hei @Ola', { mentions: { userIds: [OLA], room: false } })
        await settled()

        fake.answerUnder(`${OF_ROOM}/send/`, () => ({ body: { event_id: '$taken' } }))
        watched.resend()
        await settled()

        expect(encrypted().map(content => content['m.mentions'])).toEqual([{ user_ids: [OLA] }, { user_ids: [OLA] }])
    })
})

describe('a message of an encrypted room', () => {
    test('is a line with its text on the device that has its key', async () => {
        const { watched, sent, tellOf, lines } = await inEncryptedRoom()
        watched.send('Bare for oss')
        await settled()

        tellOf(sent(SEND_ENCRYPTED)[0], '$taken-1')
        await settled()

        expect(lines()).toEqual(['Bare for oss'])
        expect(watched.read().lines[0]).toMatchObject({ id: '$taken-1', sending: null, canEdit: true })
    })

    test('says that it cannot be read on a device without its key, and is read when the key comes', async () => {
        const first = await inEncryptedRoom()
        first.watched.send('Fra før du logget inn her')
        await settled()
        const written = asEvent(first.sent(SEND_ENCRYPTED)[0], '$earlier')
        const keys = await first.client.getCrypto()?.exportRoomKeys()
        await stopSyncedChatClients()

        const newDevice = await inEncryptedRoom({ ...ofKari, deviceId: 'KARISDEVICE2' }, [written])
        await settled()
        expect(newDevice.lines()).toEqual(['ENCRYPTED'])
        const before = newDevice.watched.read()

        await newDevice.client.getCrypto()?.importRoomKeys(keys ?? [])
        await settled()

        expect(newDevice.lines()).toEqual(['Fra før du logget inn her'])
        expect(newDevice.watched.read()).not.toBe(before)
    })
})

describe('what a device cannot decrypt', () => {
    test('is one line for a message, and none for an edit of it or for what refers to it', async () => {
        const first = await inEncryptedRoom()
        first.watched.send('Hei')
        await settled()
        first.tellOf(first.sent(SEND_ENCRYPTED)[0], '$taken-1')
        await settled()
        await first.watched.edit('$taken-1', 'Hei igjen')
        const [message, edit] = first.sent(SEND_ENCRYPTED)
        const referring = { 'm.relates_to': { rel_type: 'm.reference', event_id: '$1' } }
        const reference = { ...message, json: { ...message.json as object, ...referring } }
        await stopSyncedChatClients()

        const newDevice = await inEncryptedRoom({ ...ofKari, deviceId: 'KARISDEVICE2' }, [
            asEvent(message, '$1'),
            asEvent(edit, '$2'),
            asEvent(reference, '$3'),
        ])
        await settled()

        expect(newDevice.watched.read().lines.map(line => [line.id, line.kind === 'NOTE' && line.what]))
            .toEqual([['$1', 'ENCRYPTED']])
    })
})

describe('a room that is encrypted', () => {
    const said = { msgtype: 'm.text', body: 'I klartekst' }
    const plain = { event_id: '$plain', sender: OLA, type: 'm.room.message', content: said }

    test('marks a message that was sent without encryption, which the homeserver could read', async () => {
        const { watched, sent, tellOf } = await inEncryptedRoom(ofKari, [{ ...plain, origin_server_ts: 1000 }])
        watched.send('Kryptert')
        await settled()
        tellOf(sent(SEND_ENCRYPTED)[0], '$taken-1')
        await settled()

        expect(watched.read().lines.map(line => line.kind === 'MESSAGE' && [line.text, line.isNotEncrypted])).toEqual([
            ['I klartekst', true],
            ['Kryptert', undefined],
        ])
    })

    test('marks it also when something that only looks like the room being encrypted comes after it', async () => {
        const lookAlike = { ...plain, event_id: '$look-alike', type: 'm.room.encryption', content: {}, origin_server_ts: 1 }
        const ofAnother = { ...lookAlike, event_id: '$of-another', state_key: OLA }
        const { watched } = await inEncryptedRoom(ofKari, [{ ...plain, origin_server_ts: 1000 }, lookAlike, ofAnother])

        const marks = watched.read().lines.flatMap(line => (line.kind === 'MESSAGE' ? [line.isNotEncrypted] : []))
        expect(marks).toEqual([true])
    })

    test('does not take a new text that is not encrypted for an encrypted message', async () => {
        const { watched, sent, tell } = await inEncryptedRoom()
        watched.send('Hei')
        await settled()
        const edit = {
            event_id: '$plain-edit',
            sender: KARI,
            type: 'm.room.message',
            origin_server_ts: 3000,
            content: {
                msgtype: 'm.text',
                body: '* Byttet ut',
                'm.new_content': { msgtype: 'm.text', body: 'Byttet ut' },
                'm.relates_to': { rel_type: 'm.replace', event_id: '$taken-1' },
            },
        }
        tell({ join: { [ROOM]: { timeline: { events: [asEvent(sent(SEND_ENCRYPTED)[0], '$taken-1'), edit] } } } })
        await settled()

        expect(watched.read().lines).toMatchObject([{ text: 'Hei', isEdited: false }])
    })

    test('does not mark what was written before it was encrypted', async () => {
        const encryption = stateEvent('m.room.encryption', OLA, { algorithm: 'm.megolm.v1.aes-sha2' })
        const { watched } = await inEncryptedRoom(ofKari, [
            { ...plain, event_id: '$before', origin_server_ts: 1000 },
            encryption,
            { ...plain, event_id: '$after', origin_server_ts: 1000 },
        ])

        expect(watched.read().lines.flatMap(line => (line.kind === 'MESSAGE' ? [[line.id, line.isNotEncrypted]] : [])))
            .toEqual([['$before', undefined], ['$after', true]])
    })

    test('is not read on a new device whose encryption does not start, and the client runs all the same', async () => {
        const failing = new Error('No room for the keys')
        const starting = jest.spyOn(MatrixClient.prototype, 'initRustCrypto').mockRejectedValue(failing)
        const { client, watched, lines } = await inEncryptedRoom(ofKari, [
            { event_id: '$secret', sender: OLA, type: 'm.room.encrypted', origin_server_ts: 1, content: { algorithm: 'x' } },
        ])
        starting.mockRestore()

        expect(client.getCrypto()).toBeUndefined()
        expect(lines()).toEqual(['ENCRYPTED'])
        expect(watched.read().isEncrypted).toBe(true)
    })

    test('is not synced by a device that has kept keys and whose encryption does not start', async () => {
        const first = await inEncryptedRoom()
        await stopSyncedChatClients()
        const syncsBefore = first.fake.callsTo('/_matrix/client/v3/sync').length
        const starting = jest.spyOn(MatrixClient.prototype, 'initRustCrypto').mockRejectedValue(new Error('Broken'))

        const shown = await new Promise<string>(resolve => {
            const run = runChatSession({
                config: configFor(KARI),
                browser: first.fake.browser,
                redirectUri: REDIRECT_URI,
                show: state => {
                    if (state.status === 'FAILED' || (state.status === 'RUNNING' && state.connection === 'CONNECTED')) {
                        run.stop()
                        resolve(state.status)
                    }
                },
            })
        })
        starting.mockRestore()

        expect(shown).toBe('FAILED')
        expect(first.fake.callsTo('/_matrix/client/v3/sync')).toHaveLength(syncsBefore)
    })
})

describe('a file sent in an encrypted room', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4, 5, 6, 7, 8])
    const picture = new File([png], 'katt.png', { type: 'image/png' })
    const drawing = new File(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], 'tegning.png', {
        type: 'image/png',
    })

    /** Sends the file, and gives what the homeserver was given to keep and what the message says of the file. */
    async function sendIn(room: Awaited<ReturnType<typeof inEncryptedRoom>>, file: File) {
        room.fake.answer(UPLOAD, () => ({ body: { content_uri: 'mxc://chat.test/locked' } }))
        await room.watched.sendFile({ file })
        const kept = room.sent(UPLOAD).at(-1)?.file ?? new Blob()
        room.fake.answerUnder(MEDIA, () => ({ body: kept }))
        const message: Record<string, unknown> = room.room.getPendingEvents().at(-1)?.getContent() ?? {}
        const line = room.watched.read().lines.at(-1)
        if (line?.kind !== 'MESSAGE' || !line.file?.media) throw new Error('The file is no line with something to fetch')
        return { kept, message, file: line.file, media: line.file.media }
    }

    test('is encrypted in the browser, and its message says where it is and what unlocks it', async () => {
        const room = await inEncryptedRoom()

        const { kept, message, file } = await sendIn(room, picture)

        expect(kept.type).toBe('application/octet-stream')
        expect(kept.size).toBe(png.length)
        expect(new Uint8Array(await kept.arrayBuffer())).not.toEqual(png)
        expect(message).toMatchObject({
            msgtype: 'm.image',
            filename: 'katt.png',
            file: { url: 'mxc://chat.test/locked', key: { kty: 'oct', alg: 'A256CTR' }, hashes: {} },
        })
        expect(message.url).toBeUndefined()
        expect(file).toMatchObject({ name: 'katt.png', isPicture: true, small: file.media })
    })

    test('is fetched and unlocked as the file that was sent, and shown as the picture its own bytes say it is', async () => {
        const room = await inEncryptedRoom()
        const { media } = await sendIn(room, picture)

        const downloaded = await room.watched.fetchFile(media, 'DOWNLOAD')
        const shown = await room.watched.fetchFile(media, 'THUMBNAIL')

        expect([downloaded.type, new Uint8Array(await downloaded.arrayBuffer())]).toEqual(['application/octet-stream', png])
        expect([shown.type, new Uint8Array(await shown.arrayBuffer())]).toEqual(['image/png', png])
        // The homeserver is asked for no small picture: it could make none of what it cannot read.
        expect(room.sent(`${MEDIA}/thumbnail`)).toEqual([])
        expect(room.sent(`${MEDIA}/download/chat.test/locked`)).toHaveLength(2)
    })

    test('is no picture to show when it is a document that was sent as a picture, and is still downloaded', async () => {
        const room = await inEncryptedRoom()
        const { media } = await sendIn(room, drawing)

        await expect(room.watched.fetchFile(media, 'THUMBNAIL')).rejects.toThrow('no picture')
        await expect(room.watched.fetchFile(media, 'PICTURE')).rejects.toThrow('no picture')
        expect((await room.watched.fetchFile(media, 'DOWNLOAD')).type).toBe('application/octet-stream')
    })

    test('is not fetched whole for its line when it is more than a line shows, whatever its message says', async () => {
        const room = await inEncryptedRoom()
        const { media } = await sendIn(room, picture)
        room.fake.answerUnder(MEDIA, () => ({ body: new Blob([new Uint8Array(10 * 2 ** 20 + 1)]) }))

        await expect(room.watched.fetchFile(media, 'THUMBNAIL')).rejects.toThrow('more than is shown')
        await expect(room.watched.fetchFile({ serverName: 'chat.test', mediaId: 'plain' }, 'THUMBNAIL'))
            .rejects.toThrow('more than is shown')
    })

    test('is refused when what the homeserver gives is not the file its message tells of', async () => {
        const room = await inEncryptedRoom()
        const { kept, media } = await sendIn(room, picture)
        const changed = new Uint8Array(await kept.arrayBuffer())
        changed[10] = 255 - changed[10]
        room.fake.answerUnder(MEDIA, () => ({ body: new Blob([changed]) }))

        await expect(room.watched.fetchFile(media, 'DOWNLOAD')).rejects.toThrow('not the one')
    })
})
