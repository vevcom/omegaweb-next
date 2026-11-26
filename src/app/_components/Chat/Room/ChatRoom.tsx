'use client'
import ChatComposer from './ChatComposer'
import ChatTimeline from './ChatTimeline'
import { lineDomId } from './ChatTimelineLine'
import useChatProfiles from './useChatProfiles'
import { refusalWording } from '@/components/Chat/Membership/chatAction'
import ChatRoomActions from '@/components/Chat/Membership/ChatRoomActions'
import Button from '@/components/UI/Button'
import { refusalOf } from '@/lib/chatSession/membership'
import { watchRoomTimeline } from '@/lib/chatSession/timeline'
import { useCallback, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { LineActions } from './ChatTimelineLine'
import type { RoomOfSpace } from '@/components/Chat/Membership/ChatRoomActions'
import type { Mentions, Person, RoomTimeline, TimelineLine } from '@/lib/chatSession/timeline'
import type { MatrixClient, Room } from 'matrix-js-sdk'

type PropTypes = {
    client: MatrixClient,
    room: Room,
    isConnectionLost: boolean,
    /**
     * The other one of the room, as the app names them, where it is opened as the direct message
     * with them. The room is then called by that name. Left out, it is called what the homeserver
     * calls it.
     */
    directWith?: string,
    ofSpace?: RoomOfSpace,
}

/**
 * A room that is open: its timeline, and where a message to it is written. What is written goes
 * from the browser straight to the homeserver, and so does the word that the room is read, and
 * what the user does with a message: answering it, reacting to it, giving it a new text and
 * removing it. An answer and a new text are written where every message is. What was done is
 * said in a line that is read out, and so is what was not, with why: the homeserver did not take
 * it, or the message no longer lets the user, in which case nothing was sent. A new text that
 * was not taken is offered back and never put in the field by itself, since the user may be
 * writing something else by then. It is offered until the user takes it, lets go of it or edits
 * a message, whatever else is done meanwhile. The people of the room are shown as the app knows them, and as
 * the homeserver names them until it has answered and where it knows nobody.
 */
export default function ChatRoom({ client, room, isConnectionLost, directWith, ofSpace }: PropTypes) {
    const watched = useMemo(() => watchRoomTimeline(client, room), [client, room])
    const timeline = useSyncExternalStore(watched.subscribe, watched.read)
    const [members, setMembers] = useState<Person[]>([])
    const [answering, setAnswering] = useState<string | null>(null)
    const [editing, setEditing] = useState<Edit | null>(null)
    const [said, setSaid] = useState<{ text: string, isRefusal: boolean } | null>(null)
    const [notSaved, setNotSaved] = useState<Edit | null>(null)
    const fieldId = useId()
    const mentioned = editing?.mentioned
    const profiles = useChatProfiles(useMemo(
        () => peopleOf(timeline.lines, [...members, ...mentioned ?? []]),
        [timeline.lines, members, mentioned],
    ))
    const pageBack = useCallback(() => void watched.pageBack(), [watched])
    const bringMembers = useCallback(() => void watched.members().then(setMembers), [watched])
    const name = directWith ?? timeline.name

    const nameOf = useCallback((person: Person) => {
        const profile = profiles.get(person.id)
        return profile ? `${profile.firstname} ${profile.lastname}` : person.name
    }, [profiles])
    const named = (person: Person) => ({ id: person.id, name: nameOf(person) })
    const mentionable = useMemo(() => members.map(member => ({ id: member.id, name: nameOf(member) })), [members, nameOf])

    // What is said is of what was asked last, so an answer that comes late takes nothing newer away.
    const asks = useRef(0)
    const ask = useCallback((asked: Promise<void>, done: string | null, notDone: string, unsaved?: Edit) => {
        const asking = ++asks.current
        const say = (toSay: typeof said) => {
            if (asking === asks.current) setSaid(toSay)
        }
        setSaid(null)
        void asked.then(() => say(done === null ? null : { text: done, isRefusal: false }), (error: unknown) => {
            say({ text: `${notDone} ${refusalWording[refusalOf(error)]}`, isRefusal: true })
            if (unsaved) setNotSaved(unsaved)
        })
    }, [])
    const edit = (toEdit: Edit) => {
        setAnswering(null)
        setNotSaved(null)
        setEditing(toEdit)
    }

    const actions = useMemo((): LineActions => ({
        onResend: watched.resend,
        onDrop: watched.drop,
        onReply: id => {
            setEditing(null)
            setAnswering(id)
            document.getElementById(fieldId)?.focus()
        },
        onEdit: id => {
            const line = watched.read().lines.find(ofTimeline => ofTimeline.id === id)
            if (line?.kind !== 'TEXT') return
            setAnswering(null)
            setNotSaved(null)
            setEditing({ id, text: line.text, mentioned: watched.mentionedIn(id) })
        },
        onRemove: id => {
            const removing = watched.remove(id)
            if (removing) ask(removing, 'Meldingen er fjernet.', 'Meldingen ble ikke fjernet.')
            else setSaid({ text: `Meldingen ble ikke fjernet. ${whyNotOf(watched.read(), id)}`, isRefusal: true })
            document.getElementById(fieldId)?.focus()
        },
        onReact: (id, emoji) => ask(watched.react(id, emoji), null, 'Reaksjonen din ble ikke endret.'),
        onShow: showLine,
    }), [watched, fieldId, ask])

    const answered = timeline.lines.flatMap(line => (line.kind === 'TEXT' && line.id === answering ? [line] : [])).at(0)
    const send = (text: string, mentions: Mentions) => {
        if (!editing) {
            watched.send(text, { mentions, replyTo: answered?.id })
            setAnswering(null)
            return true
        }
        const edited = timeline.lines.find(line => line.id === editing.id)
        const isUnchanged = edited?.kind === 'TEXT' && edited.text === text.trim()
        const saving = isUnchanged ? 'UNCHANGED' : watched.edit(editing.id, text, mentions)
        // What is not sent stays in the field, which is still the new text of that message.
        if (!saving) {
            setSaid({ text: `Meldingen ble ikke endret. ${whyNotOf(timeline, editing.id)}`, isRefusal: true })
            return false
        }
        setEditing(null)
        if (saving !== 'UNCHANGED') {
            // Offered back with whom it mentioned, those picked for it too.
            const mentionedNow = [...editing.mentioned, ...members].filter((person, index, all) => (
                mentions.userIds.includes(person.id) && all.findIndex(({ id }) => id === person.id) === index
            ))
            ask(saving, 'Meldingen er endret.', 'Endringen ble ikke lagret.', { ...editing, text, mentioned: mentionedNow })
        }
        return true
    }

    return (
        <div className="h-full flex flex-col gap-3 bg-base-100 rounded-round p-(--card-padding)">
            <div className="flex flex-row flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="m-0 wrap-anywhere">{directWith ? headingOfDirectMessage(directWith) : name}</h2>
                <ChatRoomActions client={client} room={room} ofSpace={ofSpace} />
            </div>
            {isConnectionLost && (
                <p className="m-0 text-base-content/80">Får ikke kontakt med chatten. Prøver igjen ...</p>
            )}
            <ChatTimeline
                timeline={timeline}
                roomName={name}
                ownId={client.getSafeUserId()}
                profiles={profiles}
                nameOf={nameOf}
                actions={actions}
                onPageBack={pageBack}
                onEndSeen={watched.markRead}
            />
            <div role="status" className={said?.isRefusal ? 'text-s text-error' : 'sr-only'}>{said?.text}</div>
            {notSaved && (
                <div className="flex flex-row flex-wrap items-baseline gap-x-3 text-s">
                    <span>Den nye teksten din er tatt vare på.</span>
                    <Button variant="text" onClick={() => edit(notSaved)}>Rediger på nytt</Button>
                    <Button variant="text" onClick={() => setNotSaved(null)}>Forkast teksten</Button>
                </div>
            )}
            <ChatComposer
                roomName={name}
                fieldId={fieldId}
                about={editing ? { kind: 'EDIT', ...editing, mentioned: editing.mentioned.map(named) } : answered && {
                    kind: 'REPLY',
                    name: nameOf({ id: answered.senderId, name: answered.senderName }),
                    text: answered.text,
                }}
                onCancelAbout={() => {
                    setAnswering(null)
                    setEditing(null)
                }}
                mentionable={mentionable}
                canMentionRoom={timeline.canMentionRoom}
                onMentioning={bringMembers}
                onSend={send}
            />
        </div>
    )
}

/** A message that is given a new text: the text the field starts with, and whom the message mentions. */
type Edit = { id: string, text: string, mentioned: Person[] }

export function headingOfDirectMessage(name: string): string {
    return `Melding til ${name}`
}

/** Why a message does not let the user edit or remove it now, so that nothing was sent. */
function whyNotOf({ lines, isHeldUp }: RoomTimeline, id: string): string {
    if (!lines.some(line => line.id === id && line.kind === 'TEXT')) return 'Den er ikke lenger blant meldingene her.'
    return isHeldUp ? 'Send eller forkast først meldingen som ikke ble sendt.' : 'Du kan ikke gjøre det med den nå.'
}

/** Brings a message before the reader, and marks it for a moment. */
function showLine(id: string): void {
    const line = document.getElementById(lineDomId(id))
    line?.scrollIntoView({ block: 'center' })
    line?.focus({ preventScroll: true })
    line?.animate([{ backgroundColor: 'var(--color-base-300)' }, {}], 1500)
}

/** The Matrix ids of everyone the lines name, and of those who may be mentioned. */
function peopleOf(lines: readonly TimelineLine[], members: readonly Person[]): string[] {
    return Array.from(new Set([
        ...lines.flatMap(line => [
            line.senderId,
            ...(line.kind === 'NOTE' && line.about ? [line.about.id] : []),
            ...(line.kind === 'TEXT' ? line.reactions.flatMap(({ by }) => by.map(person => person.id)) : []),
        ]),
        ...members.map(member => member.id),
    ]))
}
