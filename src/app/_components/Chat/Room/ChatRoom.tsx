'use client'
import ChatComposer from './ChatComposer'
import ChatTimeline from './ChatTimeline'
import useChatProfiles from './useChatProfiles'
import SiteLink from '@/components/SiteLink/SiteLink'
import { chatLinks } from '@/app/(omegaweb)/chat/links'
import { watchRoomTimeline } from '@/lib/chatSession/timeline'
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { TimelineLine } from '@/lib/chatSession/timeline'
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
}

/**
 * A room that is open: its timeline, and where a message to it is written. What is written goes
 * from the browser straight to the homeserver. The people of the room are shown as the app knows
 * them, and as the homeserver names them until it has answered and where it knows nobody.
 */
export default function ChatRoom({ client, room, isConnectionLost, directWith }: PropTypes) {
    const watched = useMemo(() => watchRoomTimeline(client, room), [client, room])
    const timeline = useSyncExternalStore(watched.subscribe, watched.read)
    const profiles = useChatProfiles(useMemo(() => peopleOf(timeline.lines), [timeline.lines]))
    const pageBack = useCallback(() => void watched.pageBack(), [watched])
    const name = directWith ?? timeline.name

    return (
        <div className="h-full flex flex-col gap-3 bg-base-100 rounded-round p-(--card-padding)">
            <div className="flex flex-row flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="m-0 wrap-anywhere">{directWith ? headingOfDirectMessage(directWith) : name}</h2>
                <SiteLink href={chatLinks.messages()}>Alle meldinger</SiteLink>
            </div>
            {isConnectionLost && (
                <p className="m-0 text-base-content/80">Får ikke kontakt med chatten. Prøver igjen ...</p>
            )}
            <ChatTimeline
                timeline={timeline}
                roomName={name}
                ownId={client.getSafeUserId()}
                profiles={profiles}
                onPageBack={pageBack}
                onResend={watched.resend}
                onDrop={watched.drop}
            />
            <ChatComposer roomName={name} onSend={watched.send} />
        </div>
    )
}

export function headingOfDirectMessage(name: string): string {
    return `Melding til ${name}`
}

/** The Matrix ids of everyone the lines name. */
function peopleOf(lines: readonly TimelineLine[]): string[] {
    return Array.from(new Set(lines.flatMap(line => [
        line.senderId,
        ...(line.kind === 'NOTE' && line.about ? [line.about.id] : []),
    ])))
}
