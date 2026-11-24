'use client'
import { chatLinks } from './links'
import { useChatSession } from '@/components/Chat/Session/ChatSessionProvider'
import ChatSessionStatus from '@/components/Chat/Session/ChatSessionStatus'
import Tag from '@/components/Chat/SpaceAdmin/Tag'
import SiteLink from '@/components/SiteLink/SiteLink'
import { watchStandaloneRooms } from '@/lib/chatSession/rooms'
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { ChatSessionState } from '@/lib/chatSession/run'

type PropTypes = {
    /** The Matrix ids of the spaces the user is in and of their rooms, which the spaces page lists. */
    roomIdsOfSpaces: string[],
}

/**
 * The user's direct messages and groups, as the homeserver has them. A user with an account who is
 * not signed in to the chat in this browser is sent to its sign in at once. One without is asked
 * first, since signing in is what gives them an account.
 */
export default function ChatRoomList({ roomIdsOfSpaces }: PropTypes) {
    const { state, hasAccount, signIn } = useChatSession()
    const signsInAtOnce = state.status === 'SIGNED_OUT' && state.reason === 'NO_SESSION' && hasAccount

    useEffect(() => {
        if (signsInAtOnce) signIn()
    }, [signsInAtOnce, signIn])

    if (signsInAtOnce) return <p className="m-0 text-base-content/80">Logger inn på chatten ...</p>
    if (state.status !== 'RUNNING') return <ChatSessionStatus />
    return <RoomsOfRunningSession state={state} roomIdsOfSpaces={roomIdsOfSpaces} />
}

/** A room the user is in opens. One they are only asked into does not, since nothing here answers an invitation yet. */
function RoomsOfRunningSession({ state: { client, connection }, roomIdsOfSpaces }: PropTypes & {
    state: ChatSessionState & { status: 'RUNNING' },
}) {
    const watched = useMemo(() => watchStandaloneRooms(client, roomIdsOfSpaces), [client, roomIdsOfSpaces])
    const rooms = useSyncExternalStore(watched.subscribe, watched.read)

    return <>
        {connection === 'LOST' && (
            <p className="m-0 text-base-content/80">Får ikke kontakt med chatten. Prøver igjen ...</p>
        )}
        {connection === 'CONNECTING' && <p className="m-0 text-base-content/80">Henter samtalene dine ...</p>}
        {connection === 'CONNECTED' && rooms.length === 0 && (
            <p className="m-0 text-base-content/80">Du har ingen direktemeldinger eller grupper ennå.</p>
        )}
        <ul className="m-0 p-0 list-none flex flex-col gap-2">
            {rooms.map(room => (
                <li key={room.id} className="flex flex-row flex-wrap items-baseline gap-x-3 gap-y-1">
                    {room.isInvitation
                        ? <span className="font-medium">{room.name}</span>
                        : <SiteLink href={chatLinks.room(room)} className="font-medium">{room.name}</SiteLink>}
                    <Tag>{room.kind === 'DIRECT' ? 'Direktemelding' : 'Gruppe'}</Tag>
                    {room.isInvitation && <Tag>Invitasjon</Tag>}
                </li>
            ))}
        </ul>
    </>
}
