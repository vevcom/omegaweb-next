import { loadedChatSdk } from './sdk'
import type { Watched } from './watch'
import type { EventTimeline, MatrixClient, MatrixEvent, MsgType, Room, RoomState } from 'matrix-js-sdk'

/** What a timeline says in place of what it does not show, which the component puts into words. */
export type TimelineNote =
    | 'IMAGE' | 'FILE' | 'AUDIO' | 'VIDEO' | 'LOCATION' | 'STICKER'
    | 'REMOVED' | 'ENCRYPTED' | 'OTHER'
    | 'CREATED' | 'NAMED' | 'JOINED' | 'LEFT' | 'INVITED' | 'TAKEN_OUT' | 'BANNED' | 'SETTINGS'

export type Person = { id: string, name: string }

/** Who a message mentions: some of the room, or everyone in it. */
export type Mentions = { userIds: readonly string[], room: boolean }

/** The message another answers, with the beginning of its text where it is one. */
type Replied = { id: string, sender: Person, excerpt: string | null }

export type TimelineReaction = {
    key: string,
    count: number,
    /** The first of them, at most NAMED_AT_MOST. */
    by: Person[],
    /** The user's own, which is `SENDING` until the homeserver has it and can be taken back once it has. */
    own: 'NONE' | 'SENDING' | 'SENT',
}

type Shown = {
    kind: 'TEXT',
    /** The newest text of the message, which is its last edit's where it has been edited. */
    text: string,
    isEdited: boolean,
    /** `NOT_LOADED` for an answer to a message the timeline does not hold. */
    repliesTo: Replied | 'NOT_LOADED' | null,
    /** Whether it mentions the user: by name, or as one of the room where its sender may mention the room. */
    mentionsUser: boolean,
    reactions: TimelineReaction[],
    /** Whether the user may give it a new text, which is so for a text of their own the homeserver has. */
    canEdit: boolean,
    /** Whether the user may remove it: their own, and another's where the room's levels let them. */
    canRemove: boolean,
    /**
     * Where a message the user wrote here stands until the homeserver has sent it back, which is
     * when something can be asked of it. Null for every other. One that is held was not tried: no
     * message of a room is sent while an earlier one has failed.
     */
    sending: 'SENDING' | 'FAILED' | 'HELD' | null,
} | {
    kind: 'NOTE',
    what: TimelineNote,
    /** Who an invitation, a removal or a ban is of. */
    about?: Person,
    /** The name a room was given. */
    roomName?: string,
}

export type TimelineLine = Shown & {
    /** The id of the event. A message on its way has one of its own until the homeserver has given it its. */
    id: string,
    senderId: string,
    /** What the homeserver calls the sender, for one the app does not know. */
    senderName: string,
    /** Null where the homeserver gives no time that is one. */
    sentAt: number | null,
}

export type RoomTimeline = {
    name: string,
    /** The oldest first, and last the messages the user wrote here that the homeserver has not sent back. */
    lines: TimelineLine[],
    /** What is known of the messages before the first line. */
    earlier: 'SOME' | 'FETCHING' | 'FAILED' | 'NONE',
    /** Whether the room's levels let the user react. */
    canReact: boolean,
    /** Whether the room's levels let the user mention the whole room. */
    canMentionRoom: boolean,
    /**
     * Whether a message of the user's was not sent. The SDK sends nothing in the room until it is
     * sent or let go, so until then nothing is reacted to, edited or removed.
     */
    isHeldUp: boolean,
}

export type WatchedRoomTimeline = Watched<RoomTimeline> & {
    /** Fetches a page of the messages before the first line, unless one is being fetched or there are none. */
    pageBack: () => Promise<void>,
    /**
     * Sends a text message, as a line of the timeline at once. Nothing but space is no message.
     * It may mention people, and answer the message of a line.
     */
    send: (text: string, more?: { mentions?: Mentions, replyTo?: string }) => void,
    /**
     * Gives a message of the user's a new text, which mentions whom it is given. Those the message
     * did not mention before are told of it, and nobody else is a second time. This and `remove`
     * give null, and send nothing, where the line does not let the user now: the message is no
     * longer in the timeline, the room is held up, or the room's levels have changed. What they
     * give otherwise, and `react`, rejects with why the homeserver did not take it, see refusalOf,
     * and what was asked is then let go and never left waiting, since one that failed would hold
     * back every message written after it.
     */
    edit: (lineId: string, text: string, mentions?: Mentions) => Promise<void> | null,
    remove: (lineId: string) => Promise<void> | null,
    /**
     * Reacts to a message with an emoji, or takes the user's own reaction with it back. It does
     * nothing where the room does not let the user, and while the room is held up.
     */
    react: (lineId: string, key: string) => Promise<void>,
    /** Those a message mentions by name, as the homeserver names them. */
    mentionedIn: (lineId: string) => Person[],
    /** Those in the room besides the user, whom the homeserver is asked for the first time. */
    members: () => Promise<Person[]>,
    /**
     * Sends the messages that were not sent again, in the order they were written. The SDK sends
     * them one after another and gives up on the rest when one fails, so none goes before an earlier.
     */
    resend: () => void,
    /** Lets go of a message that was not sent, by the id of its line. */
    drop: (lineId: string) => void,
    /**
     * Tells the homeserver that the user has read the room to its end, which everyone in the room
     * may see, and which takes its unread away in every client of the user's. It is told once of
     * each last message. When it could not be reached it is told the next time this is called, and
     * not by itself.
     */
    markRead: () => void,
}

const PAGE_SIZE = 50
/** How many different emojis a message is shown with besides the user's own, and how many who reacted with one are named. */
const REACTIONS_AT_MOST = 20
const NAMED_AT_MOST = 5
const EXCERPT_LENGTH = 80
const EMOJI_LENGTH_AT_MOST = 40
const REMOVABLE = ['m.room.message', 'm.sticker', 'm.room.encrypted']
const TEXT_TYPES: readonly unknown[] = ['m.text', 'm.notice', 'm.emote']
const notesOfMessageTypes = new Map<unknown, TimelineNote>([
    ['m.image', 'IMAGE'],
    ['m.file', 'FILE'],
    ['m.audio', 'AUDIO'],
    ['m.video', 'VIDEO'],
    ['m.location', 'LOCATION'],
])
const NOBODY: Mentions = { userIds: [], room: false }
// One emoji as people see it: a flag, a keycap, or pictographs joined into one, each with at most
// one skin tone. What only looks like another emoji is none, so no reaction is shown as another's.
const toned = '\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}'
const pictograph = `(?:${toned}|\\p{Emoji_Presentation}\\uFE0F?|(?![#*0-9])\\p{Emoji}\\uFE0F)`
const flagOrKeycap = '\\p{Regional_Indicator}{2}|[#*0-9]\\uFE0F?\\u20E3|\\u{1F3F4}[\\u{E0020}-\\u{E007E}]{1,6}\\u{E007F}'
const oneEmoji = new RegExp(`^(?:${flagOrKeycap}|${pictograph}(?:\\u200D${pictograph}){0,3})$`, 'u')

/**
 * A room's timeline as a component shows it, which changes as the room does. It is the SDK's live
 * timeline of the room, which holds what the sync has brought and what is paged back from there.
 * The SDK puts a new one in its place when a sync left a gap, so no gap is ever in it, and what
 * was before is fetched again by paging back. The client keeps what the user sends apart from it
 * until the homeserver sends it back, see `pendingEventOrdering` in run.ts, so a message on its
 * way is last whatever arrives meanwhile, and survives the gap. A line is the same object until
 * what it shows has changed.
 */
export function watchRoomTimeline(client: MatrixClient, room: Room): WatchedRoomTimeline {
    const { Direction, EventStatus, EventType, RelationType, RoomEvent } = loadedChatSdk()
    const roomEvents = [
        RoomEvent.Timeline,
        RoomEvent.TimelineReset,
        RoomEvent.LocalEchoUpdated,
        RoomEvent.Redaction,
        RoomEvent.RedactionCancelled,
        RoomEvent.Name,
    ] as const
    const ownId = client.getSafeUserId()
    const watchers = new Set<() => void>()
    let shown: RoomTimeline | null = null
    let linesBefore = new Map<string, TimelineLine>()
    let fetching: 'FETCHING' | 'FAILED' | null = null
    let toldReadTo: string | null = null

    const changed = () => {
        shown = null
        watchers.forEach(watcher => watcher())
    }
    const hasEarlier = () => room.getLiveTimeline().getPaginationToken(Direction.Backward) !== null
    const unsent = () => room.getPendingEvents().filter(event => event.status === EventStatus.NOT_SENT)
    const isHeldUp = () => unsent().some(event => !isAct(event))
    // The SDK counts a receipt as given from when it is sent, so what the homeserver has said is asked for.
    const hasReadTo = (eventId: string) => room.getEventReadUpTo(client.getSafeUserId(), true) === eventId

    const read = (): RoomTimeline => {
        const lines = timelineLinesOf(readingOf(room, ownId, isHeldUp())).map(line => {
            const before = linesBefore.get(line.id)
            return before && isSame(before, line) ? before : line
        })
        linesBefore = new Map(lines.map(line => [line.id, line]))
        return {
            name: textOf(room.name) ?? '',
            lines,
            earlier: fetching ?? (hasEarlier() ? 'SOME' : 'NONE'),
            canReact: room.currentState.maySendEvent(EventType.Reaction, ownId),
            canMentionRoom: room.currentState.mayTriggerNotifOfType('room', ownId),
            isHeldUp: isHeldUp(),
        }
    }
    const shownNow = () => (shown ??= read())
    /** A message of the timeline that the homeserver has, which is one something is asked of. */
    const textLine = (lineId: string) => shownNow().lines
        .flatMap(line => (line.kind === 'TEXT' && line.id === lineId && !line.sending ? [line] : []))
        .at(0)
    /** Whom a message of the user's may mention, which is the whole room only where the room's levels let them. */
    const allowed = (mentions: Mentions = NOBODY): Mentions => ({
        userIds: mentions.userIds,
        room: mentions.room && room.currentState.mayTriggerNotifOfType('room', ownId),
    })
    // What failed is let go, since the SDK would send nothing more in the room while it waited.
    const act = (asked: Promise<unknown>) => asked.then(() => undefined, (error: unknown) => {
        unsent().filter(isAct).forEach(event => client.cancelPendingEvent(event))
        throw error
    })

    return {
        subscribe: onChange => {
            if (watchers.size === 0) {
                roomEvents.forEach(roomEvent => room.on(roomEvent, changed))
                shown = null
            }
            watchers.add(onChange)
            return () => {
                watchers.delete(onChange)
                if (watchers.size === 0) roomEvents.forEach(roomEvent => room.off(roomEvent, changed))
            }
        },
        read: shownNow,
        pageBack: async () => {
            if (fetching === 'FETCHING' || !hasEarlier()) return
            const paged = room.getLiveTimeline()
            fetching = 'FETCHING'
            changed()
            fetching = await client.paginateEventTimeline(paged, { backwards: true, limit: PAGE_SIZE })
                .then(() => null, () => 'FAILED' as const)
            if (paged !== room.getLiveTimeline()) {
                forgetPageOf(room, paged)
                fetching = null
            }
            changed()
        },
        // A message that is not sent says so as a line, and so does one that is sent again.
        send: (text, { mentions, replyTo } = {}) => {
            const toSend = text.trim()
            if (!toSend) return
            const message = textMessage(toSend, allowed(mentions))
            const answered = replyTo && room.findEventById(replyTo) ? { 'm.in_reply_to': { event_id: replyTo } } : null
            void client.sendMessage(room.roomId, answered ? { ...message, 'm.relates_to': answered } : message)
                .catch(() => undefined)
        },
        resend: () => unsent().forEach(event => void client.resendEvent(event, room).catch(() => undefined)),
        drop: lineId => {
            const event = unsent().find(unsentEvent => unsentEvent.getId() === lineId)
            if (event) client.cancelPendingEvent(event)
        },
        edit: (lineId, text, mentions) => {
            const toSend = text.trim()
            const [event, line] = [room.findEventById(lineId), textLine(lineId)]
            if (!event || !toSend || !line?.canEdit || line.text === toSend) return null
            const had = mentionsIn(contentOf(event, readingOf(room, ownId, false)))
            const now = allowed(mentions)
            const added = { userIds: now.userIds.filter(id => !had.userIds.includes(id)), room: now.room && !had.room }
            return act(client.sendMessage(room.roomId, {
                ...textMessage(`* ${toSend}`, added),
                'm.new_content': textMessage(toSend, now),
                'm.relates_to': { rel_type: RelationType.Replace, event_id: lineId },
            }))
        },
        remove: lineId => (textLine(lineId)?.canRemove ? act(client.redactEvent(room.roomId, lineId)) : null),
        mentionedIn: lineId => {
            const event = room.findEventById(lineId)
            const { userIds } = event ? mentionsIn(contentOf(event, readingOf(room, ownId, false))) : NOBODY
            return userIds.map(id => ({ id, name: textOf(room.getMember(id)?.name) ?? id }))
        },
        react: async (lineId, key) => {
            const line = textLine(lineId)
            if (!line || !isEmoji(key) || !shownNow().canReact || isHeldUp()) return
            const own = readingOf(room, ownId, false).reactions.get(lineId)?.get(key)
            if (own?.own === 'SENDING') return
            await act(own?.ownEventId ? client.redactEvent(room.roomId, own.ownEventId) : client.sendEvent(
                room.roomId,
                EventType.Reaction,
                { 'm.relates_to': { rel_type: RelationType.Annotation, event_id: lineId, key } },
            ))
        },
        members: async () => {
            // Without an answer, those the client knows of are the ones to pick from.
            await room.loadMembersIfNeeded().catch(() => undefined)
            return room.getJoinedMembers()
                .filter(member => member.userId !== ownId)
                .map(member => ({ id: member.userId, name: textOf(member.name) ?? member.userId }))
        },
        markRead: () => {
            const last = room.getLiveTimeline().getEvents().at(-1)
            const lastId = last?.getId()
            if (!last || !lastId || lastId === toldReadTo || hasReadTo(lastId)) return
            toldReadTo = lastId
            void client.sendReadReceipt(last).catch(() => {
                if (toldReadTo === lastId) toldReadTo = null
            })
        },
    }
}

/** Whether a text is one emoji, which is what a reaction is shown as and sent with. */
function isEmoji(text: string): boolean {
    return text.length <= EMOJI_LENGTH_AT_MOST && oneEmoji.test(text)
}

/**
 * Takes back a page that was put in a timeline that is no longer the room's, since a sync left a
 * gap while it was fetched. The SDK would otherwise know its messages as that timeline's, and end
 * the paging of the live timeline where it meets them.
 */
function forgetPageOf(room: Room, timeline: EventTimeline): void {
    const known = room.getUnfilteredTimelineSet()
    timeline.getEvents()
        .flatMap(event => textOf(event.getId()) ?? [])
        .filter(id => known.getTimelineForEvent(id) === timeline)
        .forEach(id => room.removeEvent(id))
}

/** What is sent as a text message. It always says whom it mentions, also when that is nobody, as Matrix asks of a client. */
export function textMessage(text: string, { userIds, room }: Mentions = NOBODY) {
    const msgtype: MsgType.Text = loadedChatSdk().MsgType.Text
    return {
        msgtype,
        body: text,
        'm.mentions': { ...(userIds.length > 0 && { user_ids: Array.from(new Set(userIds)) }), ...(room && { room }) },
    }
}

/** Those who reacted to a message with an emoji, by their ids, and the user's own reaction with it. */
type Reacted = { by: Map<string, string>, own: TimelineReaction['own'], ownEventId: string | null }

/**
 * What the events of a room are read with. An edit and a reaction are no lines of their own: they
 * are kept by the message they are of, and only where the timeline holds that message. Since the
 * timeline has no gaps, it holds every edit of and reaction to a message it holds.
 */
type Reading = {
    events: readonly MatrixEvent[],
    /** The events the homeserver has given, by their ids. */
    loaded: ReadonlyMap<string, MatrixEvent>,
    /** The newest edit of each message that has one. */
    edits: Map<string, MatrixEvent>,
    /** By message and then by emoji. */
    reactions: Map<string, Map<string, Reacted>>,
    ownId: string,
    state: RoomState,
    isHeldUp: boolean,
}

function readingOf(room: Room, ownId: string, isHeldUp: boolean): Reading {
    const loaded = room.getLiveTimeline().getEvents()
    const reading: Reading = {
        events: [...loaded, ...room.getPendingEvents()],
        loaded: new Map(loaded.flatMap(event => {
            const id = textOf(event.getId())
            return id ? [[id, event]] : []
        })),
        edits: new Map(),
        reactions: new Map(),
        ownId,
        state: room.currentState,
        isHeldUp,
    }
    reading.events.forEach(event => {
        try {
            keepRelation(event, reading)
        } catch {
            // An event that cannot be read is an edit of and a reaction to nothing.
        }
    })
    return reading
}

/**
 * Keeps an event that is an edit of or a reaction to a message the timeline holds. An edit counts
 * only from the one who wrote the message, of a text and as a text, so nobody changes what another
 * wrote and no edit makes a message something else. A reaction counts once for each who reacted,
 * as one emoji. One that is removed holds nothing any more, so it is neither.
 */
function keepRelation(event: MatrixEvent, reading: Reading): void {
    const relatesTo = recordOf(recordOf(event.getOriginalContent())['m.relates_to'])
    const messageId = textOf(relatesTo.event_id)
    const message = messageId === null ? undefined : reading.loaded.get(messageId)
    const senderId = textOf(event.getSender())
    if (!messageId || !message || !senderId || event.isState()) return
    if (isEdit(event)) {
        const isOfText = textIn(message.getOriginalContent()) !== null
        if (isOfText && message.getSender() === senderId && textIn(newContentOf(event)) !== null) {
            reading.edits.set(messageId, event)
        }
        return
    }
    const key = textOf(relatesTo.key)
    if (event.getType() !== 'm.reaction' || relatesTo.rel_type !== 'm.annotation' || key === null || !isEmoji(key)) return
    const ofMessage = reading.reactions.get(messageId) ?? new Map<string, Reacted>()
    const reacted = ofMessage.get(key) ?? { by: new Map<string, string>(), own: 'NONE', ownEventId: null }
    reacted.by.set(senderId, nameOfSender(event, senderId))
    if (senderId === reading.ownId) {
        reacted.own = sendingOf(event) ? 'SENDING' : 'SENT'
        reacted.ownEventId = textOf(event.getId())
    }
    reading.reactions.set(messageId, ofMessage.set(key, reacted))
}

/**
 * The lines of a timeline, from its events in the order the homeserver gave them. A text message
 * is its text, and never the HTML it may come with. What is not shown is a note of what it is.
 * These are no line: the event that removes another, since what it removed says so itself, an
 * edit and a reaction, which are shown with the message they are of, and a member's new name or
 * picture, which is no news of the room.
 *
 * An event holds whatever its sender put in it, whatever the SDK's types say. So a value is read
 * as a text only when it is one, see `textOf`, and is never made one.
 */
function timelineLinesOf(reading: Reading): TimelineLine[] {
    const lines = reading.events
        .flatMap(event => lineOf(event, reading) ?? [])
        .filter((line, index, all) => !isSettingsAgain(all[index - 1], line))
    const firstFailed = lines.findIndex(isFailed)
    return lines.map((line, index) => (index > firstFailed && isFailed(line) ? { ...line, sending: 'HELD' } : line))
}

function lineOf(event: MatrixEvent, reading: Reading): TimelineLine | null {
    const id = textOf(event.getId())
    const senderId = textOf(event.getSender())
    const shown = shownOf(event, reading)
    if (!id || !senderId || !shown) return null
    return { id, senderId, senderName: nameOfSender(event, senderId), sentAt: timeOf(event.getTs()), ...shown }
}

/** An event that cannot be read is shown as one that is not shown, so that no event keeps a room from opening. */
function shownOf(event: MatrixEvent, reading: Reading): Shown | null {
    try {
        return event.isState() ? shownOfState(event) : shownOfMessage(event, reading)
    } catch {
        return note('OTHER')
    }
}

function shownOfMessage(event: MatrixEvent, reading: Reading): Shown | null {
    const type = event.getType()
    if (type === 'm.room.redaction' || type === 'm.reaction' || isEdit(event)) return null
    if (event.isRedacted()) return REMOVABLE.includes(type) ? note('REMOVED') : null
    switch (type) {
        case 'm.room.message': {
            const content = contentOf(event, reading)
            const text = textIn(content)
            if (text === null) return note(notesOfMessageTypes.get(content.msgtype) ?? 'OTHER')
            const id = event.getId() ?? ''
            const isOnHomeserver = reading.loaded.has(id) && !reading.isHeldUp
            const isOwn = event.getSender() === reading.ownId
            return {
                kind: 'TEXT',
                text,
                isEdited: reading.edits.has(id),
                repliesTo: repliedOf(event, reading),
                mentionsUser: !isOwn && mentionsUser(content, event, reading),
                reactions: reactionsOf(reading.reactions.get(id)),
                canEdit: isOnHomeserver && isOwn && content.msgtype === 'm.text'
                    && reading.state.maySendMessage(reading.ownId),
                canRemove: isOnHomeserver && reading.state.maySendRedactionForEvent(event, reading.ownId),
                sending: sendingOf(event) ?? (reading.loaded.has(id) ? null : 'SENDING'),
            }
        }
        case 'm.sticker':
            return note('STICKER')
        case 'm.room.encrypted':
            return note('ENCRYPTED')
        default:
            return note('OTHER')
    }
}

/**
 * The reactions a message is shown with: the REACTIONS_AT_MOST emojis most have reacted with, the
 * first given first among as many, so that no number of others hides the one many gave. The
 * user's own is always among them, since it is theirs to take back.
 */
function reactionsOf(reacted: ReadonlyMap<string, Reacted> = new Map()): TimelineReaction[] {
    const all = Array.from(reacted)
    const most = new Set(all
        .toSorted(([, one], [, other]) => other.by.size - one.by.size)
        .slice(0, REACTIONS_AT_MOST)
        .map(([key]) => key))
    return all.filter(([key, { own }]) => most.has(key) || own !== 'NONE').map(([key, { by, own }]) => ({
        key,
        count: by.size,
        by: Array.from(by, ([id, name]) => ({ id, name })).slice(0, NAMED_AT_MOST),
        own,
    }))
}

/** What a message holds now: what its newest edit gave it, where it has one. */
function contentOf(event: MatrixEvent, reading: Reading): Record<string, unknown> {
    const edit = reading.edits.get(event.getId() ?? '')
    return recordOf(edit ? newContentOf(edit) : event.getOriginalContent())
}

function newContentOf(edit: MatrixEvent): unknown {
    return recordOf(edit.getOriginalContent())['m.new_content']
}

function isEdit(event: MatrixEvent): boolean {
    const relatesTo = recordOf(recordOf(event.getOriginalContent())['m.relates_to'])
    return event.getType() === 'm.room.message' && relatesTo.rel_type === 'm.replace'
}

/** An event that is a line of its own and may be answered, which an edit and what happens to the room are not. */
function isMessage(event: MatrixEvent): boolean {
    return REMOVABLE.includes(event.getType()) && !event.isState() && !isEdit(event)
}

/** What the user asks of a message and is no line while it is on its way: an edit, a reaction and a removal. */
function isAct(event: MatrixEvent): boolean {
    return event.getType() !== 'm.room.message' || isEdit(event)
}

/** The text of what a message holds, where that is a text. */
function textIn(content: unknown): string | null {
    const { msgtype, body } = recordOf(content)
    return TEXT_TYPES.includes(msgtype) ? textOf(body) : null
}

function repliedOf(event: MatrixEvent, reading: Reading): Replied | 'NOT_LOADED' | null {
    const relatesTo = recordOf(recordOf(event.getOriginalContent())['m.relates_to'])
    const id = textOf(recordOf(relatesTo['m.in_reply_to']).event_id)
    if (id === null) return null
    const replied = reading.loaded.get(id)
    const senderId = textOf(replied?.getSender())
    if (!replied || !senderId || !isMessage(replied)) return 'NOT_LOADED'
    const text = replied.isRedacted() ? null : textIn(contentOf(replied, reading))
    const sender = { id: senderId, name: nameOfSender(replied, senderId) }
    return { id, sender, excerpt: text === null ? null : excerptOf(text) }
}

function excerptOf(text: string): string {
    const letters = Array.from(text.slice(0, 4 * EXCERPT_LENGTH).replace(/\s+/g, ' ').trim())
    return letters.length > EXCERPT_LENGTH ? `${letters.slice(0, EXCERPT_LENGTH).join('')}…` : letters.join('')
}

/** Whom what a message holds says it mentions, where it says so as it should. */
function mentionsIn(content: Record<string, unknown>): { userIds: string[], room: boolean } {
    const { user_ids: userIds, room } = recordOf(content['m.mentions'])
    return { userIds: Array.isArray(userIds) ? userIds.filter(isText) : [], room: room === true }
}

/** A mention of the whole room counts only from one the room's levels let make it, as the homeserver has it. */
function mentionsUser(content: Record<string, unknown>, event: MatrixEvent, { ownId, state }: Reading): boolean {
    const { user_ids: userIds, room: ofRoom } = recordOf(content['m.mentions'])
    if (Array.isArray(userIds) && userIds.includes(ownId)) return true
    return ofRoom === true && state.mayTriggerNotifOfType('room', event.getSender() ?? '')
}

function sendingOf(event: MatrixEvent): 'SENDING' | 'FAILED' | null {
    const { EventStatus } = loadedChatSdk()
    if (event.status === null || event.status === EventStatus.SENT) return null
    return event.status === EventStatus.NOT_SENT ? 'FAILED' : 'SENDING'
}

/** A message that was not sent. The first of them in a room is the one that failed, and the later are held. */
function isFailed(line: TimelineLine): line is TimelineLine & { kind: 'TEXT' } {
    return line.kind === 'TEXT' && line.sending === 'FAILED'
}

function shownOfState(event: MatrixEvent): Shown | null {
    switch (event.getType()) {
        case 'm.room.create':
            return note('CREATED')
        case 'm.room.name':
            return { kind: 'NOTE', what: 'NAMED', roomName: textOf(event.getContent().name) ?? '' }
        case 'm.room.member':
            return shownOfMembership(event)
        default:
            return note('SETTINGS')
    }
}

function shownOfMembership(event: MatrixEvent): Shown | null {
    const memberId = textOf(event.getStateKey()) ?? ''
    const about = { id: memberId, name: textOf(event.target?.name) ?? memberId }
    const content: Record<string, unknown> = event.getContent()
    const before: Record<string, unknown> = event.getPrevContent()
    switch (content.membership) {
        case 'join':
            return before.membership === 'join' ? null : note('JOINED')
        case 'invite':
            return { kind: 'NOTE', what: 'INVITED', about }
        case 'leave':
            return event.getSender() === memberId ? note('LEFT') : { kind: 'NOTE', what: 'TAKEN_OUT', about }
        case 'ban':
            return { kind: 'NOTE', what: 'BANNED', about }
        default:
            return note('SETTINGS')
    }
}

/** A new room is given its settings one event at a time, which is one line and not six. */
function isSettingsAgain(before: TimelineLine | undefined, line: TimelineLine): boolean {
    return before?.kind === 'NOTE' && before.what === 'SETTINGS'
        && line.kind === 'NOTE' && line.what === 'SETTINGS' && line.senderId === before.senderId
}

function note(what: TimelineNote): Shown {
    return { kind: 'NOTE', what }
}

function nameOfSender(event: MatrixEvent, senderId: string): string {
    return textOf(event.sender?.name) ?? senderId
}

function textOf(value: unknown): string | null {
    return typeof value === 'string' ? value : null
}

function isText(value: unknown): value is string {
    return typeof value === 'string'
}

/** What a value holds by name, which is nothing unless it is an object. */
function recordOf(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

/** Whether two values of plain data hold the same. */
function isSame(one: unknown, other: unknown): boolean {
    if (one === other) return true
    if (typeof one !== 'object' || typeof other !== 'object' || one === null || other === null) return false
    const [ofOne, ofOther] = [one as Record<string, unknown>, other as Record<string, unknown>]
    const keys = Object.keys(ofOne)
    return keys.length === Object.keys(ofOther).length && keys.every(key => isSame(ofOne[key], ofOther[key]))
}

function timeOf(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(new Date(value).getTime()) ? value : null
}
