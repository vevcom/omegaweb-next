'use client'
import { ChatMessageLine, ChatNoteLine } from './ChatTimelineLine'
import { wordingOfNote } from './timelineWording'
import Button from '@/components/UI/Button'
import ScrollIndicator from '@/components/ScrollIndicator/ScrollIndicator'
import { osloDateTime } from '@/lib/dates/oslo'
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { RoomTimeline, TimelineLine } from '@/lib/chatSession/timeline'
import type { ChatProfile } from '@/services/chat/users/types'

const AT_END_WITHIN_PX = 40
const PAGES_BACK_WITHIN_PX = 300
const READ_OUT_AT_MOST = 5

type PropTypes = {
    timeline: RoomTimeline,
    /** What the room is called here. */
    roomName: string,
    ownId: string,
    profiles: ReadonlyMap<string, ChatProfile>,
    onPageBack: () => void,
    /** Called when the reader has the end of the timeline before them, and may be called again for the same end. */
    onEndSeen: () => void,
    onResend: () => void,
    onDrop: (lineId: string) => void,
}

/**
 * The lines of a room, the oldest at the top, in a box that scrolls. It stays at its end as lines
 * arrive while the reader is there, and stays where the reader is otherwise, also as earlier lines
 * are put in above, which are fetched as the reader nears the top. A screen reader is read what
 * arrives after the room was opened, from a log of its own, since a log of every line would also
 * read out the earlier ones as they are fetched.
 */
export default function ChatTimeline({
    timeline: { lines, earlier },
    roomName,
    ownId,
    profiles,
    onPageBack,
    onEndSeen,
    onResend,
    onDrop,
}: PropTypes) {
    const scroller = useRef<HTMLDivElement>(null)
    const place = useRef<Place>({ isAtEnd: true, fromEnd: 0, firstLineId: undefined, lastLineId: undefined })
    const [openedAt] = useState(() => lines.findLast(line => line.kind !== 'TEXT' || !line.sending)?.sentAt ?? 0)
    const arrivedSinceOpened = (line: TimelineLine) => line.sentAt !== null && line.sentAt > openedAt

    const nameOf = useCallback(({ id, name }: { id: string, name: string }) => {
        const profile = profiles.get(id)
        return profile ? `${profile.firstname} ${profile.lastname}` : name
    }, [profiles])

    const seeEnd = useCallback(() => {
        if (place.current.isAtEnd && document.visibilityState === 'visible') onEndSeen()
    }, [onEndSeen])

    const notePlace = () => {
        const box = scroller.current
        if (!box) return
        const fromEnd = box.scrollHeight - box.clientHeight - box.scrollTop
        place.current = { ...place.current, isAtEnd: fromEnd < AT_END_WITHIN_PX, fromEnd }
        if (earlier === 'SOME' && box.scrollTop < PAGES_BACK_WITHIN_PX) onPageBack()
        seeEnd()
    }

    useLayoutEffect(() => {
        const box = scroller.current
        if (!box) return
        const { isAtEnd, fromEnd, firstLineId, lastLineId } = place.current
        const last = lines.at(-1)
        const wroteJustNow = last?.senderId === ownId && last.id !== lastLineId && lines[0]?.id === firstLineId
        if (isAtEnd || wroteJustNow) box.scrollTop = box.scrollHeight
        else if (lines[0]?.id !== firstLineId) box.scrollTop = box.scrollHeight - box.clientHeight - fromEnd
        place.current = { ...place.current, firstLineId: lines[0]?.id, lastLineId: last?.id }
        if (earlier === 'SOME' && box.scrollTop < PAGES_BACK_WITHIN_PX) onPageBack()
        seeEnd()
    }, [lines, earlier, ownId, onPageBack, seeEnd])

    useEffect(() => {
        document.addEventListener('visibilitychange', seeEnd)
        return () => document.removeEventListener('visibilitychange', seeEnd)
    }, [seeEnd])

    useEffect(() => {
        const box = scroller.current
        if (!box) return undefined
        const stayAtEnd = new ResizeObserver(() => {
            if (place.current.isAtEnd) box.scrollTop = box.scrollHeight
        })
        stayAtEnd.observe(box)
        return () => stayAtEnd.disconnect()
    }, [])

    const rows = useMemo(() => rowsOf(lines), [lines])
    const arrived = lines.filter(line => arrivedSinceOpened(line) && line.senderId !== ownId).slice(-READ_OUT_AT_MOST)
    const unsent = lines.flatMap(line => (line.kind === 'TEXT' && line.sending !== 'SENDING' && line.sending ? [line] : []))

    return (
        <div className="relative flex-1 min-h-0">
            <div
                ref={scroller}
                onScroll={notePlace}
                // A box that scrolls is reached by keyboard, so it can be scrolled by it.
                tabIndex={0}
                role="group"
                aria-label={`Meldingene i ${roomName}`}
                className="
                    h-full overflow-y-auto [scrollbar-width:none] rounded-inner
                    [&::-webkit-scrollbar]:hidden
                    focus-visible:outline-2 focus-visible:outline-primary
                "
            >
                <p className="m-0 py-2 min-h-10 text-center text-s text-base-content/80">
                    {earlier === 'NONE' && 'Her begynner samtalen.'}
                    {earlier === 'FETCHING' && 'Henter eldre meldinger ...'}
                    {earlier === 'FAILED' && <>
                        Fikk ikke hentet eldre meldinger. <Button variant="text" onClick={onPageBack}>Prøv igjen</Button>
                    </>}
                </p>
                <ol className="m-0 p-0 list-none">
                    {rows.map(({ line, day }) => (
                        <Fragment key={line.id}>
                            {day && (
                                <li className="py-2 text-center">
                                    <h3 className="m-0 text-s font-medium text-base-content/80">{day}</h3>
                                </li>
                            )}
                            {line.kind === 'TEXT' ? (
                                <ChatMessageLine
                                    id={line.id}
                                    name={nameOf({ id: line.senderId, name: line.senderName })}
                                    image={profiles.get(line.senderId)?.image ?? null}
                                    sentAt={line.sentAt}
                                    text={line.text}
                                    isReply={line.isReply}
                                    sending={line.sending}
                                    onResend={onResend}
                                    onDrop={onDrop}
                                />
                            ) : (
                                <ChatNoteLine wording={wordingOfNote(line, nameOf)} sentAt={line.sentAt} />
                            )}
                        </Fragment>
                    ))}
                </ol>
            </div>
            <ScrollIndicator scrollRef={scroller} className="top-(--rounding) bottom-(--rounding) right-1" />
            <div role="log" aria-label={`Nytt i ${roomName}`} className="sr-only">
                {arrived.map(line => (
                    <p key={line.id}>
                        {line.kind === 'TEXT'
                            ? `${nameOf({ id: line.senderId, name: line.senderName })}: ${line.text}`
                            : wordingOfNote(line, nameOf)}
                    </p>
                ))}
                {unsent.map(line => (
                    <p key={line.id}>
                        {line.sending === 'FAILED'
                            ? 'En melding ble ikke sendt.'
                            : 'En melding sendes ikke før den forrige er sendt eller forkastet.'}
                    </p>
                ))}
            </div>
        </div>
    )
}

/** Where the reader is in the box, and which lines were its first and last when it was last laid out. */
type Place = {
    isAtEnd: boolean,
    fromEnd: number,
    firstLineId: string | undefined,
    lastLineId: string | undefined,
}

/**
 * The lines, each with the day it was sent, in Oslo, where it is the first of that day. Lines keep
 * the homeserver's order, so a day comes again where a clock was off. A line without a time is of
 * the day of the line before it.
 */
function rowsOf(lines: readonly TimelineLine[]): { line: TimelineLine, day: string | null }[] {
    const dayOf = (sentAt: number) => osloDateTime(new Date(sentAt)).setLocale('nb').toFormat('cccc d. LLLL yyyy')
    const days = lines.reduce<(string | null)[]>((before, { sentAt }) => [
        ...before,
        sentAt === null ? before.at(-1) ?? null : dayOf(sentAt),
    ], [])
    return lines.map((line, index) => ({ line, day: days[index] === days[index - 1] ? null : days[index] }))
}
