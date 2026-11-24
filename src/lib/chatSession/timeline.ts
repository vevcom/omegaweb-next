import { loadedChatSdk } from './sdk'
import type { Watched } from './watch'
import type { EventTimeline, MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk'

/** What a timeline says in place of what it does not show, which the component puts into words. */
export type TimelineNote =
    | 'IMAGE' | 'FILE' | 'AUDIO' | 'VIDEO' | 'LOCATION' | 'STICKER'
    | 'EDIT' | 'REACTION' | 'REMOVED' | 'ENCRYPTED' | 'OTHER'
    | 'CREATED' | 'NAMED' | 'JOINED' | 'LEFT' | 'INVITED' | 'TAKEN_OUT' | 'BANNED' | 'SETTINGS'

type Shown = {
    kind: 'TEXT',
    text: string,
    isReply: boolean,
    /**
     * Where a message the user wrote here stands until the homeserver has it. Null for every other.
     * One that is held was not tried: no message of a room is sent while an earlier one has failed.
     */
    sending: 'SENDING' | 'FAILED' | 'HELD' | null,
} | {
    kind: 'NOTE',
    what: TimelineNote,
    /** Who an invitation, a removal or a ban is of. */
    about?: { id: string, name: string },
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
}

export type WatchedRoomTimeline = Watched<RoomTimeline> & {
    /** Fetches a page of the messages before the first line, unless one is being fetched or there are none. */
    pageBack: () => Promise<void>,
    /** Sends a text message, as a line of the timeline at once. Nothing but space is no message. */
    send: (text: string) => void,
    /**
     * Sends the messages that were not sent again, in the order they were written. The SDK sends
     * them one after another and gives up on the rest when one fails, so none goes before an earlier.
     */
    resend: () => void,
    /** Lets go of a message that was not sent, by the id of its line. */
    drop: (lineId: string) => void,
}

const PAGE_SIZE = 50
const REMOVABLE = ['m.room.message', 'm.sticker', 'm.room.encrypted']
const TEXT_TYPES: readonly unknown[] = ['m.text', 'm.notice', 'm.emote']
const notesOfMessageTypes = new Map<unknown, TimelineNote>([
    ['m.image', 'IMAGE'],
    ['m.file', 'FILE'],
    ['m.audio', 'AUDIO'],
    ['m.video', 'VIDEO'],
    ['m.location', 'LOCATION'],
])

/**
 * A room's timeline as a component shows it, which changes as the room does. It is the SDK's live
 * timeline of the room, which holds what the sync has brought and what is paged back from there.
 * The SDK puts a new one in its place when a sync left a gap, so no gap is ever in it, and what
 * was before is fetched again by paging back. The client keeps what the user sends apart from it
 * until the homeserver sends it back, see `pendingEventOrdering` in run.ts, so a message on its
 * way is last whatever arrives meanwhile, and survives the gap.
 */
export function watchRoomTimeline(client: MatrixClient, room: Room): WatchedRoomTimeline {
    const { Direction, EventStatus, MatrixEventEvent, RoomEvent } = loadedChatSdk()
    const roomEvents = [
        RoomEvent.Timeline,
        RoomEvent.TimelineReset,
        RoomEvent.LocalEchoUpdated,
        RoomEvent.Redaction,
        RoomEvent.RedactionCancelled,
        RoomEvent.Name,
    ] as const
    const watchers = new Set<() => void>()
    let shown: RoomTimeline | null = null
    let fetching: 'FETCHING' | 'FAILED' | null = null

    const changed = () => {
        shown = null
        watchers.forEach(watcher => watcher())
    }
    const changedIfOfRoom = (event: MatrixEvent) => {
        if (event.getRoomId() === room.roomId) changed()
    }
    const hasEarlier = () => room.getLiveTimeline().getPaginationToken(Direction.Backward) !== null
    const unsent = () => room.getPendingEvents().filter(event => event.status === EventStatus.NOT_SENT)

    return {
        subscribe: onChange => {
            if (watchers.size === 0) {
                roomEvents.forEach(roomEvent => room.on(roomEvent, changed))
                // An edit gives the message it is of its new text after the edit itself has arrived.
                client.on(MatrixEventEvent.Replaced, changedIfOfRoom)
                shown = null
            }
            watchers.add(onChange)
            return () => {
                watchers.delete(onChange)
                if (watchers.size > 0) return
                roomEvents.forEach(roomEvent => room.off(roomEvent, changed))
                client.off(MatrixEventEvent.Replaced, changedIfOfRoom)
            }
        },
        read: () => (shown ??= {
            name: textOf(room.name) ?? '',
            lines: timelineLinesOf([...room.getLiveTimeline().getEvents(), ...room.getPendingEvents()]),
            earlier: fetching ?? (hasEarlier() ? 'SOME' : 'NONE'),
        }),
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
        send: text => {
            const toSend = text.trim()
            if (toSend) void client.sendTextMessage(room.roomId, toSend).catch(() => undefined)
        },
        resend: () => unsent().forEach(event => void client.resendEvent(event, room).catch(() => undefined)),
        drop: lineId => {
            const event = unsent().find(unsentEvent => unsentEvent.getId() === lineId)
            if (event) client.cancelPendingEvent(event)
        },
    }
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

/**
 * The lines of a timeline, from its events in the order the homeserver gave them. A text message
 * is its text, and never the HTML it may come with. What is not shown is a note of what it is.
 * Three things are no line: the event that removes another, since what it removed says so itself,
 * a reaction that was taken back, and a member's new name or picture, which is no news of the room.
 *
 * An event holds whatever its sender put in it, whatever the SDK's types say. So a value is read
 * as a text only when it is one, see `textOf`, and is never made one.
 */
function timelineLinesOf(events: readonly MatrixEvent[]): TimelineLine[] {
    const lines = events
        .flatMap(event => lineOf(event) ?? [])
        .filter((line, index, all) => !isSettingsAgain(all[index - 1], line))
    const firstFailed = lines.findIndex(isFailed)
    return lines.map((line, index) => (index > firstFailed && isFailed(line) ? { ...line, sending: 'HELD' } : line))
}

function lineOf(event: MatrixEvent): TimelineLine | null {
    const id = textOf(event.getId())
    const senderId = textOf(event.getSender())
    const shown = shownOf(event)
    if (!id || !senderId || !shown) return null
    return { id, senderId, senderName: textOf(event.sender?.name) ?? senderId, sentAt: timeOf(event.getTs()), ...shown }
}

/** An event that cannot be read is shown as one that is not shown, so that no event keeps a room from opening. */
function shownOf(event: MatrixEvent): Shown | null {
    try {
        return event.isState() ? shownOfState(event) : shownOfMessage(event)
    } catch {
        return note('OTHER')
    }
}

function shownOfMessage(event: MatrixEvent): Shown | null {
    const type = event.getType()
    if (type === 'm.room.redaction') return null
    if (event.isRedacted()) return REMOVABLE.includes(type) ? note('REMOVED') : null
    switch (type) {
        case 'm.room.message': {
            if (event.isRelation('m.replace')) return note('EDIT')
            const { msgtype, body }: Record<string, unknown> = event.getContent()
            const text = textOf(body)
            if (text === null || !TEXT_TYPES.includes(msgtype)) return note(notesOfMessageTypes.get(msgtype) ?? 'OTHER')
            return { kind: 'TEXT', text, isReply: event.replyEventId !== undefined, sending: sendingOf(event) }
        }
        case 'm.reaction':
            return note('REACTION')
        case 'm.sticker':
            return note('STICKER')
        case 'm.room.encrypted':
            return note('ENCRYPTED')
        default:
            return note('OTHER')
    }
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

function textOf(value: unknown): string | null {
    return typeof value === 'string' ? value : null
}

function timeOf(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(new Date(value).getTime()) ? value : null
}
