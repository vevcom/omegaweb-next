import { fakeChatBrowser, stopSyncedChatClients, syncedChatClient, tameChatSdk } from 'tests/chatSessionBrowser'
import { storeSession } from '@/lib/chatSession/storage'
import { watchRoomTimeline } from '@/lib/chatSession/timeline'
import { refusalOf } from '@/lib/chatSession/membership'
import { FileTooLarge, isStopped, isTooLarge } from '@/lib/chatSession/media'
import { afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import type { TimelineLine } from '@/lib/chatSession/timeline'

const KARI = '@kari:chat.test'
const OLA = '@ola:chat.test'
const MAKER = '@the-maker:chat.test'
const ROOM = '!rom:chat.test'
const OTHER_ROOM = '!annet:chat.test'
const OF_ROOM = `/_matrix/client/v3/rooms/${encodeURIComponent(ROOM)}`
const MESSAGES = `${OF_ROOM}/messages`
const SEND = `${OF_ROOM}/send/m.room.message/`
const REACT = `${OF_ROOM}/send/m.reaction/`
const REMOVE = `${OF_ROOM}/redact/`
const MEDIA = '/_matrix/client/v1/media'
const UPLOAD = '/_matrix/media/v3/upload'
const receiptOf = (eventId: string) => `${OF_ROOM}/receipt/m.read/${encodeURIComponent(eventId)}`
const ofKari = { userId: KARI, deviceId: 'KARISDEVICE1', accessToken: 'access-0', refreshToken: 'refresh-0' }

beforeAll(() => tameChatSdk(jest.spyOn))
afterEach(stopSyncedChatClients)

type Sent = { type?: string, content?: unknown, unsigned?: unknown, state_key?: string, origin_server_ts?: unknown }
// What JSON carries that is no text and that nothing can make one: turning it into a string throws.
const NO_TEXT = { toString: 1 }
const event = (id: string, sender: string, { type = 'm.room.message', content = {}, ...rest }: Sent = {}) => ({
    event_id: id,
    sender,
    type,
    content,
    origin_server_ts: 1000,
    ...rest,
})
const text = (id: string, sender: string, body: string, rest: Sent & { content?: object } = {}) =>
    event(id, sender, { ...rest, content: { msgtype: 'm.text', body, ...rest.content } })
const member = (userId: string, displayname: string, membership = 'join', rest: Sent = {}) => event(
    `$member-${userId}-${membership}-${displayname}`,
    userId,
    { type: 'm.room.member', state_key: userId, content: { membership, displayname }, ...rest },
)
const reply = (id: string, sender: string, of: unknown, body: string) =>
    text(id, sender, body, { content: { 'm.relates_to': { 'm.in_reply_to': { event_id: of } } } })
const edit = (id: string, sender: string, of: string, body: string, newContent: unknown = { msgtype: 'm.text', body }) =>
    text(id, sender, `* ${body}`, {
        content: { 'm.new_content': newContent, 'm.relates_to': { rel_type: 'm.replace', event_id: of } },
    })
const reaction = (id: string, sender: string, of: unknown, key: unknown) => event(id, sender, {
    type: 'm.reaction',
    content: { 'm.relates_to': { rel_type: 'm.annotation', event_id: of, key } },
})
const removal = (id: string, sender: string, of: string) =>
    ({ ...event(id, sender, { type: 'm.room.redaction', content: { redacts: of } }), redacts: of })
/** The levels of a room where those of `moderators` remove what others wrote and mention the whole room. */
const levels = (...moderators: string[]) => event('$levels', OLA, {
    type: 'm.room.power_levels',
    state_key: '',
    content: { users: Object.fromEntries(moderators.map(moderator => [moderator, 50])) },
})
const joined = (timeline: object[], more: object = {}) => ({
    state: {
        events: [
            // The SDK gives nobody a level in a room it knows no maker of. The maker is in no test, since the
            // maker of a room of this version holds every level whatever its levels say.
            event('$create', MAKER, { type: 'm.room.create', state_key: '', content: { room_version: '12' } }),
            member(KARI, 'Kari'),
            member(OLA, 'Ola'),
        ],
    },
    timeline: { events: timeline, prev_batch: 'before-the-sync', ...more },
})

/** Kari's browser, signed in and with the client running, in a room with Ola that holds `timeline`. */
async function inRoom(timeline: object[]) {
    const fake = fakeChatBrowser()
    storeSession(fake.browser, ofKari)
    fake.chat.rooms = { join: { [ROOM]: joined(timeline), [OTHER_ROOM]: joined([]) } }
    const { tell } = fake.tellingOfNews()
    const client = await syncedChatClient(fake.browser, KARI)
    const room = client.getRoom(ROOM)
    if (!room) throw new Error('The client was not told of the room')
    const watched = watchRoomTimeline(client, room)
    const told = { times: 0 }
    // Reads at every change, as a component does, so what is read is never older than what was told of.
    watched.subscribe(() => {
        told.times++
        watched.read()
    })
    return {
        fake,
        room,
        watched,
        told,
        tell,
        lines: () => watched.read().lines,
        /** The text lines by their ids, as what `of` gives of each. */
        texts: <Given>(of: (line: TextLine) => Given) => Object.fromEntries(watched.read().lines
            .flatMap(line => (line.kind === 'MESSAGE' ? [[line.id, of(line)] as const] : []))),
        tellOf: (events: object[], roomId = ROOM, more: object = {}) =>
            tell({ join: { [roomId]: { timeline: { events, ...more } } } }),
    }
}

type TextLine = TimelineLine & { kind: 'MESSAGE' }
/** A homeserver that takes every message, and gives each an id made of its text. */
const taking = (call: { json: unknown }) => ({ body: { event_id: `$${(call.json as { body: string }).body}` } })
const settled = () => new Promise(resolve => setTimeout(resolve, 30))
const sends = (fake: ReturnType<typeof fakeChatBrowser>) =>
    fake.calls.filter(call => call.url.pathname.startsWith(SEND))

describe('the lines of a timeline', () => {
    test('are the messages in the order the homeserver gave them, whatever their clocks say', async () => {
        const { lines } = await inRoom([
            text('$1', OLA, 'Først', { origin_server_ts: 3000 }),
            text('$2', KARI, 'Så', { origin_server_ts: 1000 }),
            text('$3', OLA, 'Sist', { origin_server_ts: 2000 }),
        ])

        const ofText = {
            kind: 'MESSAGE',
            isEdited: false,
            repliesTo: null,
            mentionsUser: false,
            reactions: [],
            canRemove: false,
            sending: null,
            file: null,
        }
        const ofOwn = { canEdit: true, canRemove: true }
        expect(lines()).toEqual([
            { id: '$1', senderId: OLA, senderName: 'Ola', sentAt: 3000, text: 'Først', canEdit: false, ...ofText },
            { id: '$2', senderId: KARI, senderName: 'Kari', sentAt: 1000, text: 'Så', ...ofText, ...ofOwn },
            { id: '$3', senderId: OLA, senderName: 'Ola', sentAt: 2000, text: 'Sist', canEdit: false, ...ofText },
        ])
    })

    test('show the text of a message and never the HTML it comes with', async () => {
        const { lines } = await inRoom([text('$1', OLA, '<b>Hei</b>', {
            content: { format: 'org.matrix.custom.html', formatted_body: '<img src=x onerror=alert(1)>' },
        })])

        expect(lines()).toMatchObject([{ kind: 'MESSAGE', text: '<b>Hei</b>' }])
        expect(JSON.stringify(lines())).not.toContain('onerror')
    })

    test('say what a thing is where it is not shown', async () => {
        const of = (msgtype: string) => ({ content: { msgtype, url: 'mxc://chat.test/abc' } })
        const { lines } = await inRoom([
            text('$location', OLA, 'Her', of('m.location')),
            text('$unknown', OLA, 'hm', of('constructor')),
            event('$bodiless', OLA, { content: { msgtype: 'm.text', body: { not: 'text' } } }),
            event('$sticker', OLA, { type: 'm.sticker', content: { body: 'katt', url: 'mxc://chat.test/def' } }),
            event('$encrypted', OLA, { type: 'm.room.encrypted', content: { algorithm: 'm.megolm.v1.aes-sha2' } }),
            event('$poll', OLA, { type: 'org.matrix.msc3381.poll.start', content: { question: 'Hva?' } }),
            event('$removed', OLA, {
                unsigned: { redacted_because: event('$removal', OLA, { type: 'm.room.redaction' }) },
            }),
            event('$removal', OLA, { type: 'm.room.redaction', content: { redacts: '$removed' } }),
        ])

        expect(lines().map(line => [line.id, line.kind === 'NOTE' ? line.what : line.text])).toEqual([
            ['$location', 'LOCATION'],
            ['$unknown', 'OTHER'],
            ['$bodiless', 'OTHER'],
            ['$sticker', 'STICKER'],
            ['$encrypted', 'ENCRYPTED'],
            ['$poll', 'OTHER'],
            ['$removed', 'REMOVED'],
        ])
    })

    test('say what happened to the room, its settings as one line and a new name of a member as none', async () => {
        const PER = '@per:chat.test'
        const state = (type: string, content: object) => event(`$${type}`, OLA, { type, state_key: '', content })
        const { lines } = await inRoom([
            state('m.room.create', {}),
            state('m.room.power_levels', {}),
            state('m.room.join_rules', { join_rule: 'invite' }),
            state('m.room.history_visibility', { history_visibility: 'shared' }),
            state('m.room.name', { name: 'Turgjengen' }),
            event('$invite', OLA, {
                type: 'm.room.member',
                state_key: PER,
                content: { membership: 'invite', displayname: 'Per' },
            }),
            member(PER, 'Per'),
            member(PER, 'Per Persen', 'join', {
                unsigned: { prev_content: { membership: 'join', displayname: 'Per' } },
            }),
            member(PER, 'Per Persen', 'leave'),
            event('$out', OLA, { type: 'm.room.member', state_key: KARI, content: { membership: 'leave' } }),
        ])

        const notes = lines().map(line => (line.kind === 'NOTE'
            ? [line.senderId, line.what, line.about?.id ?? line.roomName]
            : line))
        expect(notes).toEqual([
            [OLA, 'CREATED', undefined],
            [OLA, 'SETTINGS', undefined],
            [OLA, 'NAMED', 'Turgjengen'],
            [OLA, 'INVITED', PER],
            [PER, 'JOINED', undefined],
            [PER, 'LEFT', undefined],
            [OLA, 'TAKEN_OUT', KARI],
        ])
    })
})

describe('an event that holds something else than it should', () => {
    test('is a line that says what it can, whatever is where a text should be', async () => {
        const PER = '@per:chat.test'
        const state = (id: string, type: string, content: unknown, stateKey = '') =>
            event(id, OLA, { type, state_key: stateKey, content })
        const { lines, watched } = await inRoom([
            text('$type', OLA, 'Hei', { content: { msgtype: NO_TEXT } }),
            // A list of one text would be that text, were it made one.
            text('$list', OLA, 'Hei', { content: { msgtype: ['m.text'] } }),
            text('$body', OLA, 'Hei', { content: { body: NO_TEXT } }),
            text('$time', OLA, 'Uten tid', { origin_server_ts: NO_TEXT }),
            text('$late', OLA, 'For sent', { origin_server_ts: 9e15 }),
            state('$name', 'm.room.name', { name: NO_TEXT }),
            state('$joined', 'm.room.member', { membership: 'join', displayname: NO_TEXT }, PER),
            state('$membership', 'm.room.member', { membership: NO_TEXT }, PER),
        ])

        expect(lines().map(line => [line.id, line.kind === 'NOTE' ? line.what : line.text, line.sentAt])).toEqual([
            ['$type', 'OTHER', 1000],
            ['$list', 'OTHER', 1000],
            ['$body', 'OTHER', 1000],
            ['$time', 'Uten tid', null],
            ['$late', 'For sent', null],
            ['$name', 'NAMED', 1000],
            ['$joined', 'JOINED', 1000],
            ['$membership', 'SETTINGS', 1000],
        ])
        expect(lines().find(line => line.id === '$name')).toMatchObject({ roomName: '' })
        expect(lines().every(line => typeof line.senderName === 'string')).toBe(true)
        expect(typeof watched.read().name).toBe('string')
    })

    test('gives a message nothing when it is an edit that holds no text', async () => {
        const { lines, tellOf } = await inRoom([text('$1', OLA, 'Vi møtes kl 18'), text('$2', OLA, 'Fint')])

        tellOf([
            edit('$3', OLA, '$1', 'endret', { msgtype: NO_TEXT, body: 'Vi møtes kl 19' }),
            edit('$4', OLA, '$2', 'endret', 'ingenting'),
        ])
        await settled()

        expect(lines().map(line => (line.kind === 'NOTE' ? line.what : line.text))).toEqual(['Vi møtes kl 18', 'Fint'])
    })

    test('never keeps the other lines from showing, whatever it is', async () => {
        const broken = [
            event('$a', OLA, { content: null }),
            event('$b', OLA, { content: 'tekst' }),
            event('$c', OLA, { content: ['liste'] }),
            event('$d', OLA, { content: { msgtype: ['m.text'], body: ['Hei'] } }),
            event('$e', OLA, { content: { msgtype: 'm.text', body: 'Hei', 'm.relates_to': 'noe' } }),
            event('$f', OLA, { content: { msgtype: 'm.text', body: 'Hei', 'm.relates_to': { 'm.in_reply_to': NO_TEXT } } }),
            event('$g', OLA, { content: { msgtype: 'm.text', body: 'Hei' }, unsigned: 'usignert' }),
            event('$h', OLA, { type: 'm.room.member', state_key: OLA, content: 'medlem' }),
            event('$i', OLA, {
                type: 'm.room.member',
                state_key: OLA,
                content: { membership: 'join' },
                unsigned: { prev_content: 7 },
            }),
            event('$j', OLA, { type: 'm.room.name', state_key: '', content: null }),
            text('$l', OLA, 'Hei', { content: { 'm.mentions': 'alle' } }),
            text('$m', OLA, 'Hei', { content: { 'm.mentions': { user_ids: NO_TEXT, room: NO_TEXT } } }),
        ]
        const { room, lines } = await inRoom([
            text('$1', OLA, 'Før'),
            ...broken,
            text('$unreadable', OLA, 'Uleselig'),
            text('$2', OLA, 'Etter'),
        ])
        const unreadable = room.findEventById('$unreadable')
        if (!unreadable) throw new Error('The room has not the event')
        // As an event the SDK itself cannot read.
        unreadable.getType = () => {
            throw new Error('unreadable')
        }

        const shown = lines().map(line => (line.kind === 'NOTE' ? line.what : line.text))
        expect([shown.at(0), shown.at(-2), shown.at(-1)]).toEqual(['Før', 'OTHER', 'Etter'])
        expect(lines().map(line => line.id)).toEqual(expect.arrayContaining(broken.map(sent => sent.event_id)))
    })
})

describe('a room that is watched', () => {
    test('tells of a message that arrives in it, and of nothing when one arrives in another room', async () => {
        const { watched, lines, tellOf, told } = await inRoom([text('$1', OLA, 'Hei')])
        const before = watched.read()

        tellOf([text('$elsewhere', OLA, 'Et annet sted')], OTHER_ROOM)
        await settled()
        expect(told.times).toBe(0)
        expect(watched.read()).toBe(before)

        tellOf([text('$2', OLA, 'Er du der?')])
        await settled()
        expect(told.times).toBe(1)
        expect(lines().map(line => line.id)).toEqual(['$1', '$2'])
    })

    test('has one line of a message the homeserver sends twice', async () => {
        const { lines, tellOf } = await inRoom([text('$1', OLA, 'Hei')])

        tellOf([text('$1', OLA, 'Hei'), text('$2', OLA, 'Hallo')])
        await settled()

        expect(lines().map(line => line.id)).toEqual(['$1', '$2'])
    })

    test('pages back a page at a time, the oldest first, and says when the beginning is reached', async () => {
        const { fake, watched, lines } = await inRoom([text('$5', OLA, 'Fem'), text('$6', OLA, 'Seks')])
        const pages: Record<string, object> = {
            'before-the-sync': {
                chunk: [text('$5', OLA, 'Fem'), text('$4', OLA, 'Fire'), text('$3', OLA, 'Tre')],
                end: 'before-3',
            },
            'before-3': { chunk: [text('$2', OLA, 'To'), text('$1', OLA, 'En')] },
        }
        fake.answer(MESSAGES, call => ({ body: pages[call.url.searchParams.get('from') ?? ''] }))
        expect(watched.read().earlier).toBe('SOME')

        await watched.pageBack()
        expect(lines().map(line => line.id)).toEqual(['$3', '$4', '$5', '$6'])
        expect(watched.read().earlier).toBe('SOME')

        await watched.pageBack()
        expect(lines().map(line => line.id)).toEqual(['$1', '$2', '$3', '$4', '$5', '$6'])
        expect(watched.read().earlier).toBe('NONE')

        await watched.pageBack()
        expect(fake.callsTo(MESSAGES).map(call => [call.url.searchParams.get('from'), call.url.searchParams.get('dir')]))
            .toEqual([['before-the-sync', 'b'], ['before-3', 'b']])
    })

    test('says so when earlier messages could not be fetched, and fetches them when asked again', async () => {
        const { fake, watched, lines } = await inRoom([text('$2', OLA, 'To')])
        fake.answer(MESSAGES, () => ({ status: 500, body: { errcode: 'M_UNKNOWN' } }))

        const fetching = watched.pageBack()
        expect(watched.read().earlier).toBe('FETCHING')
        await fetching
        expect(watched.read().earlier).toBe('FAILED')

        fake.answer(MESSAGES, () => ({ body: { chunk: [text('$1', OLA, 'En')] } }))
        await watched.pageBack()
        expect(lines().map(line => line.id)).toEqual(['$1', '$2'])
    })

    test('holds what came after a gap alone, with what the user is sending last, and pages back from there', async () => {
        const { fake, watched, lines, tellOf } = await inRoom([text('$1', OLA, 'Gammel')])
        fake.answerUnder(SEND, () => 'NEVER')
        watched.send('På vei')

        tellOf([text('$8', OLA, 'Åtte'), text('$9', OLA, 'Ni')], ROOM, { limited: true, prev_batch: 'before-8' })
        await settled()

        expect(lines().map(line => (line.kind === 'MESSAGE' ? line.text : line.what))).toEqual(['Åtte', 'Ni', 'På vei'])
        fake.answer(MESSAGES, () => ({ body: { chunk: [text('$7', OLA, 'Sju')] } }))
        await watched.pageBack()
        expect(fake.callsTo(MESSAGES)[0].url.searchParams.get('from')).toBe('before-8')
        expect(lines().map(line => (line.kind === 'MESSAGE' ? line.text : line.what)))
            .toEqual(['Sju', 'Åtte', 'Ni', 'På vei'])
    })
})

describe('a page of earlier messages that arrives after a sync that left a gap', () => {
    test('is not taken for the room\'s, and paging back goes on to the beginning', async () => {
        const { fake, watched, lines, tellOf } = await inRoom([text('$5', OLA, 'Fem'), text('$6', OLA, 'Seks')])
        const earlier = [7, 6, 5, 4, 3, 2, 1].map(number => text(`$${number}`, OLA, `Nr ${number}`))
        let answerTheHeld: (answer: { body: object }) => void = () => undefined
        fake.answer(MESSAGES, call => (call.url.searchParams.get('from') === 'before-the-sync'
            ? new Promise(resolve => {
                answerTheHeld = resolve
            })
            : { body: { chunk: earlier } }))

        const fetching = watched.pageBack()
        await settled()
        tellOf([text('$8', OLA, 'Åtte'), text('$9', OLA, 'Ni')], ROOM, { limited: true, prev_batch: 'before-8' })
        await settled()
        expect(watched.read().earlier).toBe('FETCHING')
        answerTheHeld({ body: { chunk: [text('$4', OLA, 'Fire'), text('$3', OLA, 'Tre')], end: 'before-3' } })
        await fetching

        expect(lines().map(line => line.id)).toEqual(['$8', '$9'])
        expect(watched.read().earlier).toBe('SOME')

        await watched.pageBack()
        expect(fake.callsTo(MESSAGES).at(-1)?.url.searchParams.get('from')).toBe('before-8')
        expect(lines().map(line => line.id)).toEqual(['$1', '$2', '$3', '$4', '$5', '$6', '$7', '$8', '$9'])
        expect(watched.read().earlier).toBe('NONE')
    })

    test('is not said to have failed when it never arrives', async () => {
        const { fake, watched, tellOf } = await inRoom([text('$5', OLA, 'Fem')])
        let refuseTheHeld: (answer: { status: number, body: object }) => void = () => undefined
        fake.answer(MESSAGES, () => new Promise(resolve => {
            refuseTheHeld = resolve
        }))

        const fetching = watched.pageBack()
        await settled()
        tellOf([text('$9', OLA, 'Ni')], ROOM, { limited: true, prev_batch: 'before-9' })
        await settled()
        refuseTheHeld({ status: 500, body: { errcode: 'M_UNKNOWN' } })
        await fetching

        expect(watched.read().earlier).toBe('SOME')
    })
})

describe('a message the user writes', () => {
    test('is a line at once, as being sent, and one line still when the homeserver has sent it back', async () => {
        const { fake, watched, lines, tellOf } = await inRoom([text('$1', OLA, 'Hei')])
        let taken: (answer: { body: object }) => void = () => undefined
        fake.answerUnder(SEND, () => new Promise(resolve => {
            taken = resolve
        }))

        watched.send('  Hei selv  ')
        expect(lines()).toMatchObject([
            { id: '$1' },
            { senderId: KARI, senderName: 'Kari', text: 'Hei selv', sending: 'SENDING' },
        ])
        await settled()
        const [sent] = sends(fake)
        expect(sent.json).toEqual({ msgtype: 'm.text', body: 'Hei selv', 'm.mentions': {} })

        tellOf([text('$2', OLA, 'Imens')])
        await settled()
        expect(lines().map(line => line.id.startsWith('~') || line.id)).toEqual(['$1', '$2', true])

        taken({ body: { event_id: '$mine' } })
        await settled()
        // The homeserver has it, and nothing is asked of it before the sync has brought it.
        expect(lines().at(-1)).toMatchObject({ id: '$mine', text: 'Hei selv', sending: 'SENDING', canEdit: false })

        const transactionId = sent.url.pathname.slice(SEND.length)
        tellOf([text('$mine', KARI, 'Hei selv', { unsigned: { transaction_id: decodeURIComponent(transactionId) } })])
        await settled()
        expect(lines().map(line => [line.id, line.kind === 'MESSAGE' && line.sending])).toEqual([
            ['$1', null],
            ['$2', null],
            ['$mine', null],
        ])
    })

    test('is not sent when it is nothing but space', async () => {
        const { fake, watched, lines } = await inRoom([])

        watched.send(' \n ')
        await settled()

        expect(lines()).toEqual([])
        expect(sends(fake)).toHaveLength(0)
    })

    test('fails when the homeserver refuses it, and holds every later one back until it is sent', async () => {
        const { fake, watched, lines } = await inRoom([])
        const written = () => lines().map(line => line.kind === 'MESSAGE' && [line.text, line.sending])
        const bodiesSent = () => sends(fake).map(call => (call.json as { body: string }).body)
        fake.answerUnder(SEND, () => ({ status: 403, body: { errcode: 'M_FORBIDDEN', error: 'Nei' } }))

        watched.send('En')
        await settled()
        watched.send('To')
        watched.send('Tre')
        await settled()
        expect(written()).toEqual([['En', 'FAILED'], ['To', 'HELD'], ['Tre', 'HELD']])
        expect(bodiesSent()).toEqual(['En'])

        watched.resend()
        expect(written()).toEqual([['En', 'SENDING'], ['To', 'SENDING'], ['Tre', 'SENDING']])
        await settled()
        expect(written()).toEqual([['En', 'FAILED'], ['To', 'HELD'], ['Tre', 'HELD']])
        expect(bodiesSent()).toEqual(['En', 'En'])

        fake.answerUnder(SEND, call => ({ body: { event_id: `$${(call.json as { body: string }).body}` } }))
        watched.resend()
        await settled()
        expect(bodiesSent()).toEqual(['En', 'En', 'En', 'To', 'Tre'])
        expect(lines().map(line => line.id)).toEqual(['$En', '$To', '$Tre'])
    })

    test('is let go when it was not sent, and the next one that was held is then the one to send again', async () => {
        const { fake, watched, lines } = await inRoom([])
        const written = () => lines().map(line => line.kind === 'MESSAGE' && [line.text, line.sending])
        fake.answerUnder(SEND, () => ({ status: 403, body: { errcode: 'M_FORBIDDEN', error: 'Nei' } }))
        watched.send('En')
        await settled()
        watched.send('To')
        watched.send('Tre')

        watched.drop(lines()[0].id)
        expect(written()).toEqual([['To', 'FAILED'], ['Tre', 'HELD']])
        watched.drop(lines()[1].id)
        expect(written()).toEqual([['To', 'FAILED']])
        await settled()
        expect(sends(fake)).toHaveLength(1)
    })
})

describe('a message the homeserver has taken that the sync does not bring back', () => {
    const shown = (lines: () => TimelineLine[]) => lines().map(line => line.kind === 'MESSAGE' && [line.text, line.sending])

    test('is no longer on its way after a sync that left a gap, and is one line when it is paged back', async () => {
        const { fake, watched, lines, tellOf } = await inRoom([text('$1', OLA, 'Gammel')])
        fake.answerUnder(SEND, taking)
        watched.send('Tatt')
        await settled()
        expect(shown(lines)).toEqual([['Gammel', null], ['Tatt', 'SENDING']])

        tellOf([text('$8', OLA, 'Åtte'), text('$9', OLA, 'Ni')], ROOM, { limited: true, prev_batch: 'before-8' })
        await settled()
        expect(shown(lines)).toEqual([['Åtte', null], ['Ni', null]])

        fake.answer(MESSAGES, () => ({ body: { chunk: [text('$Tatt', KARI, 'Tatt'), text('$1', OLA, 'Gammel')] } }))
        await watched.pageBack()
        expect(shown(lines)).toEqual([['Gammel', null], ['Tatt', null], ['Åtte', null], ['Ni', null]])
        expect(lines()[1]).toMatchObject({ id: '$Tatt', canEdit: true, canRemove: true })
    })

    test('is one line when it is paged back before anything else has let go of it', async () => {
        const { fake, watched, lines, tellOf } = await inRoom([text('$1', OLA, 'Gammel')])
        let taken: (answer: { body: object }) => void = () => undefined
        fake.answerUnder(SEND, () => new Promise(resolve => {
            taken = resolve
        }))
        watched.send('Tatt')
        await settled()
        tellOf([text('$9', OLA, 'Ni')], ROOM, { limited: true, prev_batch: 'before-9' })
        await settled()
        taken({ body: { event_id: '$Tatt' } })
        await settled()
        expect(shown(lines)).toEqual([['Ni', null], ['Tatt', 'SENDING']])

        fake.answer(MESSAGES, () => ({ body: { chunk: [text('$Tatt', KARI, 'Tatt')] } }))
        await watched.pageBack()
        expect(shown(lines)).toEqual([['Tatt', null], ['Ni', null]])
    })

    test('is waited for through the sync that was on its way and the next, and no longer', async () => {
        const { fake, watched, lines, tellOf } = await inRoom([])
        fake.answerUnder(SEND, taking)
        watched.send('Tatt')
        await settled()

        tellOf([text('$2', OLA, 'To')])
        await settled()
        expect(shown(lines)).toEqual([['To', null], ['Tatt', 'SENDING']])
        tellOf([text('$3', OLA, 'Tre')])
        await settled()
        expect(shown(lines)).toEqual([['To', null], ['Tre', null]])
    })

    test('is one line that is sent when the sync that left the gap brings it', async () => {
        const { fake, watched, lines, tellOf } = await inRoom([])
        fake.answerUnder(SEND, taking)
        watched.send('Tatt')
        await settled()

        tellOf([text('$9', OLA, 'Ni'), text('$Tatt', KARI, 'Tatt')], ROOM, { limited: true, prev_batch: 'before-9' })
        await settled()
        expect(shown(lines)).toEqual([['Ni', null], ['Tatt', null]])
    })

    test('is a line again when a later sync brings it after all', async () => {
        const { fake, watched, lines, tellOf } = await inRoom([])
        fake.answerUnder(SEND, taking)
        watched.send('Tatt')
        await settled()
        tellOf([text('$9', OLA, 'Ni')], ROOM, { limited: true, prev_batch: 'before-9' })
        await settled()
        expect(shown(lines)).toEqual([['Ni', null]])

        tellOf([text('$Tatt', KARI, 'Tatt')])
        await settled()
        expect(shown(lines)).toEqual([['Ni', null], ['Tatt', null]])
    })
})

describe('a room that is read to its end', () => {
    test('is said to be read at the homeserver, up to its last message and once', async () => {
        const { fake, watched } = await inRoom([text('$1', OLA, 'Hei'), text('$2', OLA, 'Hallo')])

        watched.markRead()
        watched.markRead()
        await settled()
        watched.markRead()
        await settled()

        expect(fake.callsTo(receiptOf('$2')).map(call => call.method)).toEqual(['POST'])
        expect(fake.callsTo(receiptOf('$1'))).toHaveLength(0)
    })

    test('is said to be read again when more has arrived, and not what the homeserver has said is read', async () => {
        const { fake, watched, tell, tellOf } = await inRoom([text('$1', OLA, 'Hei')])
        const readBy = (userId: string, eventId: string) => {
            const receipt = { type: 'm.receipt', content: { [eventId]: { 'm.read': { [userId]: { ts: 1 } } } } }
            return { join: { [ROOM]: { ephemeral: { events: [receipt] } } } }
        }
        watched.markRead()

        tellOf([text('$2', OLA, 'Er du der?')])
        await settled()
        watched.markRead()
        await settled()
        expect(fake.callsTo(receiptOf('$2'))).toHaveLength(1)

        // As when the user read it in another client.
        tellOf([text('$3', OLA, 'Hallo?')])
        tell(readBy(KARI, '$3'))
        await settled()
        watched.markRead()
        await settled()
        expect(fake.callsTo(receiptOf('$3'))).toHaveLength(0)

        tellOf([text('$4', OLA, 'Fint')])
        tell(readBy(OLA, '$4'))
        await settled()
        watched.markRead()
        await settled()
        expect(fake.callsTo(receiptOf('$4'))).toHaveLength(1)
    })

    test('is said to be read again when the homeserver could not be told', async () => {
        const { fake, watched } = await inRoom([text('$1', OLA, 'Hei')])
        fake.answer(receiptOf('$1'), () => 'UNREACHABLE')

        watched.markRead()
        await settled()
        fake.answer(receiptOf('$1'), () => ({ body: {} }))
        watched.markRead()
        await settled()
        watched.markRead()
        await settled()

        expect(fake.callsTo(receiptOf('$1'))).toHaveLength(2)
    })

    test('is read up to the last message the homeserver has, whatever the user is sending', async () => {
        const { fake, watched } = await inRoom([text('$1', OLA, 'Hei')])
        fake.answerUnder(SEND, () => 'NEVER')
        watched.send('På vei')

        watched.markRead()
        await settled()

        expect(fake.calls.filter(call => call.url.pathname.includes('/receipt/')).map(call => call.url.pathname))
            .toEqual([receiptOf('$1')])
    })
})

describe('a message that answers another', () => {
    test('says whom and what it answers, the newest text cut short, when the timeline holds that message', async () => {
        const long = `Vi  møtes\n${'å'.repeat(100)}`
        const { fake, watched, texts } = await inRoom([
            text('$2', OLA, 'Gammel tekst'),
            edit('$2e', OLA, '$2', long),
            event('$3', OLA, { content: { msgtype: 'm.image', body: 'bilde.png' } }),
            reply('$4', KARI, '$2', 'Ja'),
            reply('$5', KARI, '$3', 'Fint bilde'),
            reply('$6', KARI, '$1', 'Til en som ikke er hentet'),
            reply('$7', KARI, '$2e', 'Til en redigering'),
            reply('$8', KARI, '$elsewhere', 'Til en i et annet rom'),
            reply('$9', KARI, NO_TEXT, 'Til ingenting'),
        ])

        const ola = { id: OLA, name: 'Ola' }
        expect(texts(line => line.repliesTo)).toMatchObject({
            $4: { id: '$2', sender: ola, excerpt: `Vi møtes ${'å'.repeat(71)}…` },
            $5: { id: '$3', sender: ola, excerpt: 'bilde.png' },
            $6: 'NOT_LOADED',
            $7: 'NOT_LOADED',
            $8: 'NOT_LOADED',
            $9: null,
        })

        fake.answer(MESSAGES, () => ({ body: { chunk: [text('$1', OLA, 'Den første')] } }))
        await watched.pageBack()
        expect(texts(line => line.repliesTo).$6).toEqual({ id: '$1', sender: ola, excerpt: 'Den første' })
    })

    test('is sent as an answer to a message the timeline holds, and as no answer to any other', async () => {
        const { fake, watched } = await inRoom([text('$1', OLA, 'Hei')])
        fake.answerUnder(SEND, taking)

        const ofText = { msgtype: 'm.text', 'm.mentions': {} }
        watched.send('Hei selv', { replyTo: '$1' })
        watched.send('Til hvem?', { replyTo: '$unknown' })
        await settled()

        expect(sends(fake).map(call => call.json)).toEqual([
            { ...ofText, body: 'Hei selv', 'm.relates_to': { 'm.in_reply_to': { event_id: '$1' } } },
            { ...ofText, body: 'Til hvem?' },
        ])
    })
})

describe('an edit', () => {
    test('gives the message its newest text and is no line, and the text before it when it is removed', async () => {
        const { texts, lines, tellOf } = await inRoom([text('$1', OLA, 'Kl 18'), text('$2', OLA, 'Fint')])

        tellOf([edit('$3', OLA, '$1', 'Kl 19'), edit('$4', OLA, '$1', 'Kl 20')])
        await settled()
        expect(lines().map(line => line.id)).toEqual(['$1', '$2'])
        expect(texts(line => [line.text, line.isEdited])).toEqual({ $1: ['Kl 20', true], $2: ['Fint', false] })

        tellOf([removal('$5', OLA, '$4')])
        await settled()
        expect(texts(line => line.text).$1).toBe('Kl 19')
        // Once it is removed nothing says it was an edit, here or from the homeserver, so it is a message that was removed.
        expect(lines().map(line => [line.id, line.kind === 'NOTE' && line.what])).toEqual([
            ['$1', false], ['$2', false], ['$4', 'REMOVED'],
        ])
    })

    test('counts only from the one who wrote the message, of a text message and as one', async () => {
        const PER = '@per:chat.test'
        const { fake, watched, lines } = await inRoom([
            text('$text', OLA, 'Olas egen'),
            text('$other', OLA, 'Olas andre'),
            event('$image', OLA, { content: { msgtype: 'm.image', body: 'bilde.png' } }),
            member(OLA, 'Ola', 'join', { unsigned: { prev_content: { membership: 'join' } } }),
            edit('$by-another', PER, '$text', 'Pers ord i Olas munn'),
            edit('$of-image', OLA, '$image', 'Et bilde blir tekst'),
            edit('$to-image', OLA, '$text', 'x', { msgtype: 'm.image', body: 'Tekst blir et bilde' }),
            edit('$of-member', OLA, `$member-${OLA}-join-Ola`, 'Et medlem blir tekst'),
            edit('$of-text', OLA, '$other', 'En redigering'),
            edit('$of-edit', OLA, '$of-text', 'En redigering av en redigering'),
            edit('$of-earlier', OLA, '$earlier', 'Ny tekst'),
        ])

        expect(lines().map(line => [line.id, line.kind === 'MESSAGE' ? line.text : line.what]))
            .toEqual([['$text', 'Olas egen'], ['$other', 'En redigering'], ['$image', '']])

        fake.answer(MESSAGES, () => ({ body: { chunk: [text('$earlier', OLA, 'Før')] } }))
        await watched.pageBack()
        expect(lines()[0]).toMatchObject({ id: '$earlier', text: 'Ny tekst', isEdited: true })
    })

    test('of the user\'s own is sent with whom its text mentions, tells only those it adds, and shows at once', async () => {
        const PER = '@per:chat.test'
        const { fake, watched, texts } = await inRoom([
            member(PER, 'Per'),
            text('$mine', KARI, 'Hei Ola', { content: { 'm.mentions': { user_ids: [OLA, 7], room: 'ja' } } }),
            text('$olas', OLA, 'Hei'),
            event('$notice', KARI, { content: { msgtype: 'm.notice', body: 'Fra en robot' } }),
        ])
        fake.answerUnder(SEND, () => 'NEVER')
        expect(texts(line => line.canEdit)).toEqual({ $mine: true, $olas: false, $notice: false })
        expect(watched.mentionedIn('$mine')).toEqual([{ id: OLA, name: 'Ola' }])

        expect([
            watched.edit('$olas', 'Ikke min'),
            watched.edit('$mine', ' Hei Ola '),
            watched.edit('$mine', ' '),
            watched.edit('$gone', 'Finnes ikke'),
        ]).toEqual([null, null, null, null])
        expect(watched.edit('$mine', 'Hallo Ola og Per', { userIds: [OLA, PER], room: true })).not.toBeNull()
        await settled()

        expect(sends(fake).map(call => call.json)).toEqual([{
            msgtype: 'm.text',
            body: '* Hallo Ola og Per',
            'm.mentions': { user_ids: [PER] },
            'm.new_content': { msgtype: 'm.text', body: 'Hallo Ola og Per', 'm.mentions': { user_ids: [OLA, PER] } },
            'm.relates_to': { rel_type: 'm.replace', event_id: '$mine' },
        }])
        expect(texts(line => [line.text, line.isEdited]).$mine).toEqual(['Hallo Ola og Per', true])
    })

    test('that no longer names one the message mentioned mentions them no more', async () => {
        const { fake, watched } = await inRoom([
            text('$mine', KARI, 'Hei @Ola', { content: { 'm.mentions': { user_ids: [OLA] } } }),
        ])
        fake.answerUnder(SEND, () => 'NEVER')

        void watched.edit('$mine', 'Hei alle')
        await settled()

        const [sent] = sends(fake).map(call => call.json as Record<string, unknown>)
        expect([sent['m.mentions'], sent['m.new_content']])
            .toEqual([{}, { msgtype: 'm.text', body: 'Hei alle', 'm.mentions': {} }])
    })
})

describe('reactions', () => {
    test('are shown with the message, each emoji with how many reacted, who, and whether the user did', async () => {
        const { lines, texts, tellOf } = await inRoom([
            text('$1', OLA, 'Pizza?'),
            reaction('$a', OLA, '$1', '👍'),
            reaction('$b', KARI, '$1', '👍'),
            reaction('$c', OLA, '$1', '🇳🇴'),
            reaction('$again', OLA, '$1', '👍'),
        ])

        expect(lines().map(line => line.id)).toEqual(['$1'])
        expect(texts(line => line.reactions).$1).toEqual([
            { key: '👍', count: 2, by: [{ id: OLA, name: 'Ola' }, { id: KARI, name: 'Kari' }], own: 'SENT' },
            { key: '🇳🇴', count: 1, by: [{ id: OLA, name: 'Ola' }], own: 'NONE' },
        ])

        tellOf([removal('$d', KARI, '$b'), removal('$e', OLA, '$c')])
        await settled()
        expect(texts(line => line.reactions).$1).toEqual([
            { key: '👍', count: 1, by: [{ id: OLA, name: 'Ola' }], own: 'NONE' },
        ])
    })

    test('count only as one emoji to a message the timeline holds, and a message has no more than twenty', async () => {
        const emojis = Array.from({ length: 30 }, (_, index) => String.fromCodePoint(0x1F600 + index))
        const { texts } = await inRoom([
            text('$1', OLA, 'Pizza?'),
            text('$2', OLA, 'Eller taco?'),
            reaction('$long', OLA, '$1', '👍'.repeat(5000)),
            reaction('$word', OLA, '$1', 'enig'),
            reaction('$html', OLA, '$1', '<img src=x onerror=alert(1)>'),
            reaction('$two', OLA, '$1', '👍👍'),
            reaction('$none', OLA, '$1', NO_TEXT),
            reaction('$nowhere', OLA, NO_TEXT, '👍'),
            reaction('$elsewhere', OLA, '$in-another-room', '👍'),
            ...emojis.map((emoji, index) => reaction(`$r${index}`, OLA, '$2', emoji)),
            ...Array.from({ length: 3000 }, (_, index) => reaction(`$many${index}`, `@nr${index}:chat.test`, '$2', '😀')),
        ])

        const { $1: ofFirst, $2: ofSecond } = texts(line => line.reactions)
        expect(ofFirst).toEqual([])
        expect(ofSecond.map(({ key }) => key)).toEqual(emojis.slice(0, 20))
        expect(ofSecond[0]).toMatchObject({ count: 3001, own: 'NONE' })
        expect(ofSecond[0].by).toHaveLength(5)
    })

    test('count only as an emoji that does not look like another, with one skin tone and a few joined at most', async () => {
        const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}'
        const england = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}'
        const real = ['👍', '👍\uFE0F', '❤\uFE0F', '👍🏽', family, england, '1\uFE0F\u20E3']
        const lookalikes = [
            '👍\uFE0F\uFE0F',
            '👍🏽🏽🏽🏽',
            '👍\u{E0061}\u{E007F}',
            Array.from({ length: 10 }, () => '👍').join('\u200D'),
            '©',
            '™',
        ]
        const { texts } = await inRoom([
            text('$1', OLA, 'Pizza?'),
            ...[...real, ...lookalikes].map((key, index) => reaction(`$r${index}`, OLA, '$1', key)),
        ])

        expect(texts(line => line.reactions.map(({ key }) => key)).$1).toEqual(real)
    })

    test('show the emojis most have given, however many others were given first, and always the user\'s own', async () => {
        const crafted = Array.from({ length: 25 }, (_, index) => String.fromCodePoint(0x1F600 + index))
        const { texts } = await inRoom([
            text('$1', OLA, 'Pizza?'),
            ...crafted.map((emoji, index) => reaction(`$crafted${index}`, '@mallory:chat.test', '$1', emoji)),
            reaction('$common1', OLA, '$1', '👍'),
            reaction('$common2', '@per:chat.test', '$1', '👍'),
            reaction('$own', KARI, '$1', '🎉'),
        ])

        const shown = texts(line => line.reactions.map(({ key, count, own }) => [key, count, own])).$1
        expect(shown).toEqual([...crafted.slice(0, 19).map(emoji => [emoji, 1, 'NONE']), ['👍', 2, 'NONE'], ['🎉', 1, 'SENT']])
    })

    test('are sent by the user and taken back, once however often it is asked', async () => {
        const { fake, watched, texts } = await inRoom([text('$1', OLA, 'Pizza?')])
        let taken: (answer: { body: object }) => void = () => undefined
        fake.answerUnder(REACT, () => new Promise(resolve => {
            taken = resolve
        }))
        const ownOf = () => texts(line => line.reactions.map(({ key, count, own }) => [key, count, own])).$1
        const called = (pathnameStart: string) => fake.calls.filter(call => call.url.pathname.startsWith(pathnameStart))

        const reacting = watched.react('$1', '👍')
        await Promise.all([watched.react('$1', '👍'), watched.react('$1', 'enig'), watched.react('$unknown', '👍')])
        await settled()
        expect(ownOf()).toEqual([['👍', 1, 'SENDING']])
        expect(called(REACT).map(call => call.json))
            .toEqual([{ 'm.relates_to': { rel_type: 'm.annotation', event_id: '$1', key: '👍' } }])

        taken({ body: { event_id: '$mine' } })
        await reacting
        expect(ownOf()).toEqual([['👍', 1, 'SENT']])

        fake.answerUnder(REMOVE, () => ({ body: { event_id: '$taken-back' } }))
        await watched.react('$1', '👍')
        expect(ownOf()).toEqual([])
        expect(called(REMOVE).map(call => call.url.pathname.slice(REMOVE.length).split('/')[0])).toEqual(['%24mine'])
    })
})

describe('a message that is removed', () => {
    test('is the user\'s to remove when it is their own, and another\'s where the room\'s levels let them', async () => {
        const { texts, tellOf } = await inRoom([text('$olas', OLA, 'Hei'), text('$mine', KARI, 'Hei selv')])
        expect(texts(line => line.canRemove)).toEqual({ $olas: false, $mine: true })

        tellOf([levels(KARI)])
        await settled()
        expect(texts(line => line.canRemove)).toEqual({ $olas: true, $mine: true })
    })

    test('says so in place of its text at once, and holds its text again when the homeserver refuses', async () => {
        const { fake, watched, lines } = await inRoom([text('$olas', OLA, 'Hei'), text('$mine', KARI, 'Hemmelig')])
        const shown = () => lines().map(line => (line.kind === 'MESSAGE' ? line.text : line.what))
        let answerIt: (answer: { status?: number, body: object }) => void = () => undefined
        fake.answerUnder(REMOVE, () => new Promise(resolve => {
            answerIt = resolve
        }))

        expect([watched.remove('$olas'), watched.remove('$gone')]).toEqual([null, null])
        const refused = watched.remove('$mine')?.then(() => null, refusalOf)
        await settled()
        expect(shown()).toEqual(['Hei', 'REMOVED'])
        expect(fake.calls.filter(call => call.url.pathname.startsWith(REMOVE))).toHaveLength(1)

        answerIt({ status: 403, body: { errcode: 'M_FORBIDDEN', error: 'Nei' } })
        expect(await refused).toBe('REFUSED')
        expect(shown()).toEqual(['Hei', 'Hemmelig'])

        fake.answerUnder(REMOVE, () => ({ body: { event_id: '$removal' } }))
        await watched.remove('$mine')
        expect(shown()).toEqual(['Hei', 'REMOVED'])
    })
})

describe('what the user asks of a message', () => {
    test('is let go when it fails, so that what is written after it is sent', async () => {
        const { fake, room, watched, texts } = await inRoom([text('$mine', KARI, 'Hei'), text('$olas', OLA, 'Hallo')])
        fake.answerUnder(REACT, () => 'UNREACHABLE')
        fake.answerUnder(SEND, call => ((call.json as { body: string }).body.startsWith('*')
            ? { status: 403, body: { errcode: 'M_FORBIDDEN', error: 'Nei' } }
            : { body: { event_id: '$after' } }))
        const heldUp: boolean[] = []
        watched.subscribe(() => heldUp.push(watched.read().isHeldUp))

        expect(await watched.react('$olas', '👍').then(() => null, refusalOf)).toBe('UNREACHABLE')
        expect(await watched.edit('$mine', 'Hei igjen')?.then(() => null, refusalOf)).toBe('REFUSED')
        expect(room.getPendingEvents()).toHaveLength(0)
        expect(texts(line => [line.text, line.isEdited, line.reactions]))
            .toEqual({ $mine: ['Hei', false, []], $olas: ['Hallo', false, []] })
        expect(heldUp).not.toContain(true)

        watched.send('Etterpå')
        await settled()
        expect(texts(line => line.text).$after).toBe('Etterpå')
    })

    test('is not asked while a message of the user\'s was not sent, which the timeline says', async () => {
        const { fake, watched, texts } = await inRoom([
            text('$mine', KARI, 'Hei'),
            text('$olas', OLA, 'Hallo'),
            levels(KARI),
        ])
        fake.answerUnder(SEND, () => ({ status: 403, body: { errcode: 'M_FORBIDDEN', error: 'Nei' } }))
        expect(watched.read().isHeldUp).toBe(false)
        watched.send('Sendes ikke')
        await settled()
        const callsBefore = fake.calls.length

        expect(watched.read().isHeldUp).toBe(true)
        expect(texts(line => [line.canEdit, line.canRemove])).toMatchObject({ $mine: [false, false], $olas: [false, false] })
        await watched.react('$olas', '👍')
        expect([watched.edit('$mine', 'Ny'), watched.remove('$mine')]).toEqual([null, null])
        expect(fake.calls).toHaveLength(callsBefore)
        expect(texts(line => line.text)).toMatchObject({ $mine: 'Hei', $olas: 'Hallo' })
    })
})

describe('a mention', () => {
    test('is of the user when it names them, or the whole room from one the room\'s levels let', async () => {
        const PER = '@per:chat.test'
        const mentioning = (id: string, sender: string, mentions: unknown) =>
            text(id, sender, 'Hei', { content: { 'm.mentions': mentions } })
        const { texts, tellOf } = await inRoom([
            levels(OLA),
            member(PER, 'Per'),
            mentioning('$named', PER, { user_ids: [OLA, KARI] }),
            mentioning('$others', PER, { user_ids: [OLA] }),
            mentioning('$as-text', PER, { user_ids: KARI }),
            mentioning('$room', OLA, { room: true }),
            mentioning('$room-unallowed', PER, { room: true }),
            mentioning('$own', KARI, { user_ids: [KARI], room: true }),
            text('$in-text', PER, `Hei ${KARI} og Kari`),
            text('$edited', PER, 'Hei'),
        ])
        expect(texts(line => line.mentionsUser)).toEqual({
            $named: true,
            $others: false,
            '$as-text': false,
            $room: true,
            '$room-unallowed': false,
            $own: false,
            '$in-text': false,
            $edited: false,
        })

        const naming = { msgtype: 'm.text', body: 'Hei Kari', 'm.mentions': { user_ids: [KARI] } }
        tellOf([edit('$e', PER, '$edited', 'Hei Kari', naming)])
        await settled()
        expect(texts(line => line.mentionsUser).$edited).toBe(true)
    })

    test('is sent with the message, once of each, and of the whole room only from one who may', async () => {
        const { fake, watched, tellOf } = await inRoom([])
        fake.answerUnder(SEND, taking)
        expect(watched.read().canMentionRoom).toBe(false)

        watched.send('Hei @Ola og @room', { mentions: { userIds: [OLA, OLA], room: true } })
        tellOf([levels(KARI)])
        await settled()
        expect(watched.read().canMentionRoom).toBe(true)
        watched.send('Hei @room', { mentions: { userIds: [], room: true } })
        await settled()

        expect(sends(fake).map(call => (call.json as Record<string, unknown>)['m.mentions']))
            .toEqual([{ user_ids: [OLA] }, { room: true }])
    })

    test('is picked among those in the room, whom the homeserver is asked for once', async () => {
        const [PER, GONE] = ['@per:chat.test', '@gone:chat.test']
        const { fake, watched } = await inRoom([])
        fake.answer(`${OF_ROOM}/members`, () => ({
            body: { chunk: [member(KARI, 'Kari'), member(OLA, 'Ola'), member(PER, 'Per'), member(GONE, 'Borte', 'leave')] },
        }))

        const picked = await watched.members()
        await watched.members()

        expect(picked).toEqual([{ id: OLA, name: 'Ola' }, { id: PER, name: 'Per' }])
        expect(fake.callsTo(`${OF_ROOM}/members`)).toHaveLength(1)
    })
})

describe('a file and a picture', () => {
    // eslint-disable-next-line id-length -- What Matrix calls a picture's width and height.
    const sized = (width: unknown, height: unknown) => ({ w: width, h: height })
    const sent = (id: string, msgtype: string, content: object) => event(id, OLA, { content: { msgtype, ...content } })
    const files = (lines: () => TimelineLine[]) => lines().map(line => (line.kind === 'MESSAGE' ? line.file : line.what))

    test('are messages with what they are said to be, and sound and video are files', async () => {
        const { lines, tellOf } = await inRoom([
            sent('$picture', 'm.image', {
                body: 'Se her!',
                filename: 'katt.png',
                url: 'mxc://chat.test/abc',
                info: { mimetype: 'image/png', size: 2048, ...sized(1200, 800) },
            }),
            sent('$file', 'm.file', { body: 'notat.pdf', url: 'mxc://chat.test/def', info: { size: 10 } }),
            sent('$sound', 'm.audio', { body: 'lyd.ogg', filename: 'lyd.ogg', url: 'mxc://chat.test/ghi' }),
            sent('$video', 'm.video', { body: 'film.mp4', url: 'mxc://chat.test/jkl' }),
        ])

        const ofFile = { isPicture: false, size: null, box: { width: 320, height: 240 } }
        expect(lines().map(line => line.kind === 'MESSAGE' && [line.text, line.canEdit, line.file])).toEqual([
            ['Se her!', false, {
                name: 'katt.png',
                isPicture: true,
                media: { serverName: 'chat.test', mediaId: 'abc' },
                size: 2048,
                box: { width: 320, height: 213 },
            }],
            ['', false, { name: 'notat.pdf', ...ofFile, media: { serverName: 'chat.test', mediaId: 'def' }, size: 10 }],
            ['', false, { name: 'lyd.ogg', ...ofFile, media: { serverName: 'chat.test', mediaId: 'ghi' } }],
            ['', false, { name: 'film.mp4', ...ofFile, media: { serverName: 'chat.test', mediaId: 'jkl' } }],
        ])

        const before = lines()
        tellOf([text('$next', OLA, 'Mer')])
        await settled()
        expect(lines().slice(0, 4).every((line, index) => line === before[index])).toBe(true)
    })

    test('have no address to fetch from but one of the homeserver\'s', async () => {
        const { lines } = await inRoom([
            'https://evil.example/katt.png',
            'https://chat.test/abc',
            'MXC://chat.test/abc',
            'mxc://../abc',
            'mxc://./abc',
            // eslint-disable-next-line no-script-url -- What a message may hold, which is fetched from nowhere.
            'javascript:alert(1)',
            'data:image/svg+xml,<svg onload=alert(1)>',
            'mxc://chat.test/../../_synapse/admin/v1/users',
            'mxc://chat.test/abc?x=1',
            'mxc://chat.test/abc/def',
            'mxc:///abc',
            NO_TEXT,
            undefined,
        ].map((url, index) => sent(`$${index}`, 'm.image', { body: 'katt.png', url })))

        expect(files(lines)).toEqual(Array(13).fill(expect.objectContaining({ name: 'katt.png', media: null })))
    })

    test('have a name that is one line of text and no path, whatever the message calls them', async () => {
        const named = (id: string, content: object) => sent(id, 'm.file', { url: 'mxc://chat.test/abc', ...content })
        const { lines } = await inRoom([
            named('$turned', { body: 'faktura\u202Efdp.exe' }),
            named('$path', { body: '..\\../etc/passwd' }),
            named('$lines', { body: 'en\nto\u2028tre\u0000' }),
            named('$long', { body: `${'a'.repeat(500)}.pdf` }),
            named('$spaced', { body: `et   navn \t med${' '.repeat(300)}rom.pdf` }),
            named('$cut', { body: `${'a'.repeat(119)}😀😀` }),
            named('$nothing', { body: NO_TEXT, filename: NO_TEXT }),
            sent('$picture', 'm.image', { body: ' \n ' }),
            named('$html', { body: '<img src=x onerror=alert(1)>.html', filename: 5 }),
        ])

        expect(lines().map(line => line.kind === 'MESSAGE' && [line.file?.name, line.text])).toEqual([
            ['fakturafdp.exe', ''],
            ['....etcpasswd', ''],
            ['entotre', ''],
            ['a'.repeat(120), ''],
            ['et navn med rom.pdf', ''],
            [`${'a'.repeat(119)}😀`, ''],
            ['fil', ''],
            ['bilde', ''],
            ['<img src=x onerror=alert(1)>.html', ''],
        ])
    })

    test('keep a box for a picture that is within what a line takes, whatever size the message says', async () => {
        const said = (id: string, info: unknown) => sent(id, 'm.image', { body: 'b.png', url: 'mxc://chat.test/abc', info })
        const { lines } = await inRoom([
            said('$wide', { ...sized(1e9, 1), size: 1e300 }),
            said('$tall', { ...sized(1, 1e9), size: -5 }),
            said('$small', { ...sized(20, 10), size: '12' }),
            said('$negative', { ...sized(-400, 300), size: 1.5 }),
            said('$texts', sized('400', '300')),
            said('$none', NO_TEXT),
            said('$endless', { ...sized(1e309, 100), size: 2 ** 53 - 1 }),
            said('$real', { ...sized(600, 400), size: 2 ** 40 }),
        ])

        expect(lines().map(line => line.kind === 'MESSAGE' && [line.file?.box, line.file?.size])).toEqual([
            [{ width: 320, height: 80 }, null],
            [{ width: 48, height: 192 }, null],
            [{ width: 48, height: 48 }, null],
            [{ width: 320, height: 240 }, null],
            [{ width: 320, height: 240 }, null],
            [{ width: 320, height: 240 }, null],
            [{ width: 320, height: 240 }, null],
            [{ width: 320, height: 213 }, 2 ** 40],
        ])
    })

    test('are answered, reacted to and removed as any message, and are never given a new text', async () => {
        const { fake, watched, texts, tellOf } = await inRoom([
            event('$mine', KARI, { content: { msgtype: 'm.file', body: 'notat.pdf', url: 'mxc://chat.test/abc' } }),
        ])
        fake.answerUnder(SEND, taking)

        expect(texts(line => [line.canEdit, line.canRemove])).toEqual({ $mine: [false, true] })
        expect(watched.edit('$mine', 'Noe annet')).toBeNull()
        tellOf([edit('$edit', KARI, '$mine', 'Noe annet'), reaction('$r', OLA, '$mine', '👍')])
        await settled()
        expect(texts(line => [line.text, line.file?.name, line.reactions.length]))
            .toEqual({ $mine: ['', 'notat.pdf', 1] })
        expect(sends(fake)).toHaveLength(0)
    })
})

describe('a file that is fetched', () => {
    const media = { serverName: 'chat.test', mediaId: 'abc' }
    const png = new Blob(['png'], { type: 'image/png' })
    const svg = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], {
        type: 'image/svg+xml',
    })
    const html = new Blob(['<script>alert(1)</script>'], { type: 'text/html' })

    test('is asked of the homeserver as the user, a picture as the small one it made or as itself', async () => {
        const { fake, watched } = await inRoom([])
        fake.answerUnder(MEDIA, () => ({ body: png }))

        const thumbnail = await watched.fetchFile(media, 'THUMBNAIL')
        const picture = await watched.fetchFile(media, 'PICTURE')

        expect([thumbnail.type, await thumbnail.text(), picture.type]).toEqual(['image/png', 'png', 'image/png'])
        const [ofThumbnail, ofPicture] = fake.calls.filter(call => call.url.pathname.startsWith(MEDIA))
        expect(`${ofThumbnail.url.pathname}${ofThumbnail.url.search}`)
            .toBe(`${MEDIA}/thumbnail/chat.test/abc?width=640&height=480&method=scale`)
        expect(ofPicture.url.pathname).toBe(`${MEDIA}/download/chat.test/abc`)
        expect([ofThumbnail.token, ofPicture.token]).toEqual(['Bearer access-0', 'Bearer access-0'])
    })

    test('is no picture to show when the homeserver says it is a document, such as an SVG', async () => {
        const { fake, watched } = await inRoom([])
        for (const given of [svg, html, new Blob(['?']), new Blob(['x'], { type: 'image/svg+xml; charset=utf-8' })]) {
            fake.answerUnder(MEDIA, () => ({ body: given }))
            await expect(watched.fetchFile(media, 'THUMBNAIL')).rejects.toThrow('no picture')
            await expect(watched.fetchFile(media, 'PICTURE')).rejects.toThrow('no picture')
        }
    })

    test('is downloaded as bytes that are nothing to a browser, whatever the homeserver says they are', async () => {
        const { fake, watched } = await inRoom([])
        for (const given of [svg, html, png]) {
            fake.answerUnder(MEDIA, () => ({ body: given }))
            const fetched = await watched.fetchFile(media, 'DOWNLOAD')
            expect([fetched.type, await fetched.text()]).toEqual(['application/octet-stream', await given.text()])
        }
        expect(fake.calls.at(-1)?.url.pathname).toBe(`${MEDIA}/download/chat.test/abc`)
    })

    test('says so when the homeserver does not give it', async () => {
        const { fake, watched } = await inRoom([])
        fake.answerUnder(MEDIA, () => ({ status: 400, body: { errcode: 'M_UNKNOWN', error: 'Cannot find any thumbnails' } }))
        await expect(watched.fetchFile(media, 'THUMBNAIL')).rejects.toMatchObject({ errcode: 'M_UNKNOWN' })
    })
})

describe('a file the user sends', () => {
    const picture = new File(['x'.repeat(300)], 'katt.png', { type: 'image/png' })
    const uploads = (fake: ReturnType<typeof fakeChatBrowser>) => fake.callsTo(UPLOAD)
    const taken = (fake: ReturnType<typeof fakeChatBrowser>) => {
        fake.answer(UPLOAD, () => ({ body: { content_uri: 'mxc://chat.test/new' } }))
        fake.answerUnder(SEND, () => ({ body: { event_id: '$sent' } }))
    }

    test('is uploaded from the browser and then sent as a picture, with its text, as a line at once', async () => {
        const { fake, watched, lines } = await inRoom([text('$1', OLA, 'Hei')])
        taken(fake)

        await watched.sendFile({ file: picture, width: 1200, height: 800 }, {
            text: ' Se @Ola ',
            mentions: { userIds: [OLA], room: false },
            replyTo: '$1',
        })
        expect(lines().at(-1)).toMatchObject({
            text: 'Se @Ola',
            sending: 'SENDING',
            file: { name: 'katt.png', isPicture: true, media: { serverName: 'chat.test', mediaId: 'new' }, size: 300 },
        })
        await settled()

        const [upload] = uploads(fake)
        expect([upload.method, upload.contentType, upload.file?.size, upload.token])
            .toEqual(['POST', 'image/png', 300, 'Bearer access-0'])
        expect(sends(fake).map(call => call.json)).toEqual([{
            msgtype: 'm.image',
            body: 'Se @Ola',
            filename: 'katt.png',
            url: 'mxc://chat.test/new',
            // eslint-disable-next-line id-length -- What Matrix calls a picture's width and height.
            info: { mimetype: 'image/png', size: 300, w: 1200, h: 800 },
            'm.mentions': { user_ids: [OLA] },
            'm.relates_to': { 'm.in_reply_to': { event_id: '$1' } },
        }])
    })

    test('is sent as a file when it is no picture that is shown, an SVG too, under its name', async () => {
        const { fake, watched } = await inRoom([])
        taken(fake)

        const drawing = new File(['<svg/>'], 'tegning.svg', { type: 'image/svg+xml' })
        await watched.sendFile({ file: drawing, width: 10, height: 10 })
        await watched.sendFile({ file: new File(['?'], 'ukjent') })
        await settled()

        expect(uploads(fake).map(call => call.contentType)).toEqual(['image/svg+xml', 'application/octet-stream'])
        expect(sends(fake).map(call => call.json)).toEqual([{
            msgtype: 'm.file',
            body: 'tegning.svg',
            filename: 'tegning.svg',
            url: 'mxc://chat.test/new',
            info: { mimetype: 'image/svg+xml', size: 6 },
            'm.mentions': {},
        }, {
            msgtype: 'm.file',
            body: 'ukjent',
            filename: 'ukjent',
            url: 'mxc://chat.test/new',
            info: { mimetype: 'application/octet-stream', size: 1 },
            'm.mentions': {},
        }])
    })

    test('is not uploaded when it is over the homeserver\'s limit, which is asked for once', async () => {
        const { fake, watched, lines } = await inRoom([])
        taken(fake)
        fake.answer(`${MEDIA}/config`, () => ({ body: { 'm.upload.size': 299 } }))

        const refused = await watched.sendFile({ file: picture }).catch((error: unknown) => error)
        expect(refused).toBeInstanceOf(FileTooLarge)
        expect([isTooLarge(refused), refused instanceof FileTooLarge && refused.limit]).toEqual([true, 299])
        expect(await watched.uploadLimit()).toBe(299)
        expect([uploads(fake).length, sends(fake).length, lines().length]).toEqual([0, 0, 0])
        expect(fake.callsTo(`${MEDIA}/config`)).toHaveLength(1)

        await watched.sendFile({ file: new File(['x'.repeat(299)], 'akkurat.png', { type: 'image/png' }) })
        expect(uploads(fake)).toHaveLength(1)
    })

    test('is tried when the homeserver says no limit, and is too large when the homeserver then says so', async () => {
        const { fake, watched, lines } = await inRoom([])
        fake.answer(`${MEDIA}/config`, () => ({ status: 500, body: { errcode: 'M_UNKNOWN' } }))
        fake.answer(UPLOAD, () => ({ status: 413, body: { errcode: 'M_TOO_LARGE', error: 'Too large' } }))

        const refused = await watched.sendFile({ file: picture }).catch((error: unknown) => error)
        expect([isTooLarge(refused), refused instanceof FileTooLarge]).toEqual([true, false])
        expect(await watched.uploadLimit()).toBeNull()
        expect(fake.callsTo(`${MEDIA}/config`)).toHaveLength(2)

        const ofProxy = new Blob(['<html>Request Entity Too Large</html>'], { type: 'text/html' })
        fake.answer(UPLOAD, () => ({ status: 413, body: ofProxy }))
        expect(isTooLarge(await watched.sendFile({ file: picture }).catch((error: unknown) => error))).toBe(true)
        expect([sends(fake).length, lines().length]).toEqual([0, 0])
    })

    test('is not sent when the upload fails or is stopped, which says why', async () => {
        const { fake, watched, lines } = await inRoom([])
        fake.answerUnder(SEND, taking)

        fake.answer(UPLOAD, () => 'UNREACHABLE')
        const unreached = await watched.sendFile({ file: picture }).catch((error: unknown) => error)
        expect([refusalOf(unreached), isTooLarge(unreached), isStopped(unreached)]).toEqual(['UNREACHABLE', false, false])

        fake.answer(UPLOAD, () => ({ status: 403, body: { errcode: 'M_FORBIDDEN', error: 'Nei' } }))
        const refused = await watched.sendFile({ file: picture }).catch((error: unknown) => error)
        expect([refusalOf(refused), isTooLarge(refused)]).toEqual(['REFUSED', false])

        fake.answer(UPLOAD, () => 'NEVER')
        const stop = new AbortController()
        const stopped = watched.sendFile({ file: picture }, { signal: stop.signal }).catch((error: unknown) => error)
        await settled()
        stop.abort()
        expect(isStopped(await stopped)).toBe(true)

        await settled()
        expect([sends(fake).length, lines().length, watched.read().isHeldUp]).toEqual([0, 0, false])
    })
})

describe('a line', () => {
    test('is the same object until what it shows has changed, so only that line is shown anew', async () => {
        const { lines, tellOf } = await inRoom([text('$1', OLA, 'Pizza?'), text('$2', OLA, 'Eller taco?')])
        const [first, second] = lines()

        tellOf([reaction('$a', OLA, '$2', '🌮'), text('$3', OLA, 'Hallo?')])
        await settled()

        expect(lines()[0]).toBe(first)
        expect(lines()[1]).not.toBe(second)
        expect(lines()[1]).toMatchObject({ reactions: [{ key: '🌮' }] })
    })
})
