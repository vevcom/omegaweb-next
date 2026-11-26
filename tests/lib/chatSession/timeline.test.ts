import { fakeChatBrowser, stopSyncedChatClients, syncedChatClient, tameChatSdk } from 'tests/chatSessionBrowser'
import { storeSession } from '@/lib/chatSession/storage'
import { watchRoomTimeline } from '@/lib/chatSession/timeline'
import { afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'

const KARI = '@kari:chat.test'
const OLA = '@ola:chat.test'
const ROOM = '!rom:chat.test'
const OTHER_ROOM = '!annet:chat.test'
const MESSAGES = `/_matrix/client/v3/rooms/${encodeURIComponent(ROOM)}/messages`
const SEND = `/_matrix/client/v3/rooms/${encodeURIComponent(ROOM)}/send/m.room.message/`
const receiptOf = (eventId: string) =>
    `/_matrix/client/v3/rooms/${encodeURIComponent(ROOM)}/receipt/m.read/${encodeURIComponent(eventId)}`
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
const joined = (timeline: object[], more: object = {}) => ({
    state: { events: [member(KARI, 'Kari'), member(OLA, 'Ola')] },
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
        tellOf: (events: object[], roomId = ROOM, more: object = {}) =>
            tell({ join: { [roomId]: { timeline: { events, ...more } } } }),
    }
}

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

        const ofText = { kind: 'TEXT', isReply: false, sending: null }
        expect(lines()).toEqual([
            { id: '$1', senderId: OLA, senderName: 'Ola', sentAt: 3000, text: 'Først', ...ofText },
            { id: '$2', senderId: KARI, senderName: 'Kari', sentAt: 1000, text: 'Så', ...ofText },
            { id: '$3', senderId: OLA, senderName: 'Ola', sentAt: 2000, text: 'Sist', ...ofText },
        ])
    })

    test('show the text of a message and never the HTML it comes with', async () => {
        const { lines } = await inRoom([text('$1', OLA, '<b>Hei</b>', {
            content: { format: 'org.matrix.custom.html', formatted_body: '<img src=x onerror=alert(1)>' },
        })])

        expect(lines()).toMatchObject([{ kind: 'TEXT', text: '<b>Hei</b>' }])
        expect(JSON.stringify(lines())).not.toContain('onerror')
    })

    test('say what a thing is where it is not shown', async () => {
        const of = (msgtype: string) => ({ content: { msgtype, url: 'mxc://chat.test/abc' } })
        const { lines } = await inRoom([
            text('$image', OLA, 'bilde.png', of('m.image')),
            text('$file', OLA, 'notat.pdf', of('m.file')),
            text('$audio', OLA, 'lyd.ogg', of('m.audio')),
            text('$video', OLA, 'film.mp4', of('m.video')),
            text('$unknown', OLA, 'hm', of('constructor')),
            event('$bodiless', OLA, { content: { msgtype: 'm.text', body: { not: 'text' } } }),
            text('$reply', OLA, 'Ja', { content: { 'm.relates_to': { 'm.in_reply_to': { event_id: '$image' } } } }),
            event('$reaction', OLA, {
                type: 'm.reaction',
                content: { 'm.relates_to': { rel_type: 'm.annotation', event_id: '$reply', key: '👍' } },
            }),
            event('$sticker', OLA, { type: 'm.sticker', content: { body: 'katt', url: 'mxc://chat.test/def' } }),
            event('$encrypted', OLA, { type: 'm.room.encrypted', content: { algorithm: 'm.megolm.v1.aes-sha2' } }),
            event('$poll', OLA, { type: 'org.matrix.msc3381.poll.start', content: { question: 'Hva?' } }),
            event('$removed', OLA, {
                unsigned: { redacted_because: event('$removal', OLA, { type: 'm.room.redaction' }) },
            }),
            event('$removal', OLA, { type: 'm.room.redaction', content: { redacts: '$removed' } }),
        ])

        expect(lines().map(line => [line.id, line.kind === 'NOTE' ? line.what : line.text])).toEqual([
            ['$image', 'IMAGE'],
            ['$file', 'FILE'],
            ['$audio', 'AUDIO'],
            ['$video', 'VIDEO'],
            ['$unknown', 'OTHER'],
            ['$bodiless', 'OTHER'],
            ['$reply', 'Ja'],
            ['$reaction', 'REACTION'],
            ['$sticker', 'STICKER'],
            ['$encrypted', 'ENCRYPTED'],
            ['$poll', 'OTHER'],
            ['$removed', 'REMOVED'],
        ])
        expect(lines().find(line => line.id === '$reply')).toMatchObject({ isReply: true })
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

    test('show a message that was edited with its new text, and the edit as a line that says so', async () => {
        const { lines, tellOf, told } = await inRoom([text('$1', OLA, 'Vi møtes kl 18')])

        tellOf([text('$2', OLA, '* Vi møtes kl 19', {
            content: {
                'm.new_content': { msgtype: 'm.text', body: 'Vi møtes kl 19' },
                'm.relates_to': { rel_type: 'm.replace', event_id: '$1' },
            },
        })])
        await settled()

        expect(told.times).toBeGreaterThan(0)
        expect(lines().map(line => (line.kind === 'NOTE' ? line.what : line.text))).toEqual(['Vi møtes kl 19', 'EDIT'])
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

    test('does not keep the room from showing when it is an edit, which gives another message what it holds', async () => {
        const { lines, tellOf } = await inRoom([text('$1', OLA, 'Vi møtes kl 18'), text('$2', OLA, 'Fint')])
        const edit = (id: string, of: string, newContent: unknown) => text(id, OLA, '* endret', {
            content: { 'm.new_content': newContent, 'm.relates_to': { rel_type: 'm.replace', event_id: of } },
        })

        tellOf([edit('$3', '$1', { msgtype: NO_TEXT, body: 'Vi møtes kl 19' }), edit('$4', '$2', 'ingenting')])
        await settled()

        expect(lines().map(line => (line.kind === 'NOTE' ? line.what : line.text)))
            .toEqual(['OTHER', 'OTHER', 'EDIT', 'EDIT'])
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
            event('$k', OLA, { type: 'm.reaction', content: { 'm.relates_to': NO_TEXT } }),
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

        expect(lines().map(line => (line.kind === 'TEXT' ? line.text : line.what))).toEqual(['Åtte', 'Ni', 'På vei'])
        fake.answer(MESSAGES, () => ({ body: { chunk: [text('$7', OLA, 'Sju')] } }))
        await watched.pageBack()
        expect(fake.callsTo(MESSAGES)[0].url.searchParams.get('from')).toBe('before-8')
        expect(lines().map(line => (line.kind === 'TEXT' ? line.text : line.what))).toEqual(['Sju', 'Åtte', 'Ni', 'På vei'])
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
        expect(sent.json).toEqual({ msgtype: 'm.text', body: 'Hei selv' })

        tellOf([text('$2', OLA, 'Imens')])
        await settled()
        expect(lines().map(line => line.id.startsWith('~') || line.id)).toEqual(['$1', '$2', true])

        taken({ body: { event_id: '$mine' } })
        await settled()
        expect(lines().at(-1)).toMatchObject({ id: '$mine', text: 'Hei selv', sending: null })

        const transactionId = sent.url.pathname.slice(SEND.length)
        tellOf([text('$mine', KARI, 'Hei selv', { unsigned: { transaction_id: decodeURIComponent(transactionId) } })])
        await settled()
        expect(lines().map(line => [line.id, line.kind === 'TEXT' && line.sending])).toEqual([
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
        const written = () => lines().map(line => line.kind === 'TEXT' && [line.text, line.sending])
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
        expect(lines().map(line => [line.id, line.kind === 'TEXT' && line.sending]))
            .toEqual([['$En', null], ['$To', null], ['$Tre', null]])
    })

    test('is let go when it was not sent, and the next one that was held is then the one to send again', async () => {
        const { fake, watched, lines } = await inRoom([])
        const written = () => lines().map(line => line.kind === 'TEXT' && [line.text, line.sending])
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
