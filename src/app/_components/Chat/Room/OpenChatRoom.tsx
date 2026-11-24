'use client'
import ChatRoom, { headingOfDirectMessage } from './ChatRoom'
import { useChatSession } from '@/components/Chat/Session/ChatSessionProvider'
import ChatSessionStatus from '@/components/Chat/Session/ChatSessionStatus'
import { directRoomWith, joinedRoom } from '@/lib/chatSession/rooms'
import { watchAtSync } from '@/lib/chatSession/watch'
import { useMemo, useSyncExternalStore } from 'react'
import type { ChatSessionState } from '@/lib/chatSession/run'
import type { ReactNode } from 'react'

type PropTypes = {
    /**
     * The room to open: the one with a Matrix id, or the direct message with the user who has one,
     * who is called `name` here.
     */
    room: { id: string } | { directWith: string, name: string },
    /** What is said in place of the room when the user is in none such. */
    children: ReactNode,
}

/**
 * Opens a room of the user's in the browser's session with the chat. It is found among the rooms
 * the homeserver has told the client of, so a room the user is not in does not open, whatever the
 * address says.
 */
export default function OpenChatRoom({ room, children }: PropTypes) {
    const { state } = useChatSession()

    return state.status === 'RUNNING'
        ? <RoomOfRunningSession state={state} room={room}>{children}</RoomOfRunningSession>
        : <NoRoom directWith={nameOfOther(room)}><ChatSessionStatus /></NoRoom>
}

function RoomOfRunningSession({ state: { client, connection }, room: wanted, children }: PropTypes & {
    state: ChatSessionState & { status: 'RUNNING' },
}) {
    const roomId = 'id' in wanted ? wanted.id : null
    const directWith = 'directWith' in wanted ? wanted.directWith : null
    const name = nameOfOther(wanted)
    const watched = useMemo(() => watchAtSync(client, () => {
        if (roomId !== null) return joinedRoom(client, roomId)
        return directWith === null ? null : directRoomWith(client, directWith)
    }), [client, roomId, directWith])
    const room = useSyncExternalStore(watched.subscribe, watched.read)

    const isConnectionLost = connection === 'LOST'

    if (room) {
        return (
            <ChatRoom
                key={room.roomId}
                client={client}
                room={room}
                isConnectionLost={isConnectionLost}
                directWith={name}
            />
        )
    }
    return (
        <NoRoom directWith={name}>
            {connection === 'CONNECTING' && <p className="m-0 text-base-content/80">Henter samtalen ...</p>}
            {isConnectionLost && (
                <p className="m-0 text-base-content/80">Får ikke kontakt med chatten. Prøver igjen ...</p>
            )}
            {connection === 'CONNECTED' && children}
        </NoRoom>
    )
}

function NoRoom({ directWith, children }: { directWith?: string, children: ReactNode }) {
    return (
        <div className="bg-base-100 rounded-round p-(--card-padding) flex flex-col gap-3">
            <h2 className="m-0">{directWith ? headingOfDirectMessage(directWith) : 'Samtale'}</h2>
            {children}
        </div>
    )
}

function nameOfOther(room: PropTypes['room']): string | undefined {
    return 'name' in room ? room.name : undefined
}
