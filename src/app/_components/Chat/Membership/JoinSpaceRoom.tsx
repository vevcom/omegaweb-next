'use client'
import { chatAction } from './chatAction'
import { useChatSession } from '@/components/Chat/Session/ChatSessionProvider'
import Form from '@/components/Form/Form'
import { joinRoom } from '@/lib/chatSession/membership'

type PropTypes = {
    /** The Matrix id of the room. */
    roomId: string,
    isPrivate: boolean,
}

/**
 * What is shown in place of a room of a space the user is let into and is not in yet. An open room
 * is joined from here: the homeserver lets the members of the space in. A private one the chat
 * sync puts those picked for it in, so there is only to wait.
 */
export default function JoinSpaceRoom({ roomId, isPrivate }: PropTypes) {
    const { state } = useChatSession()

    if (isPrivate) return <p className="m-0">Du blir lagt til i dette rommet om litt.</p>
    if (state.status !== 'RUNNING') return null
    const { client } = state
    return <>
        <p className="m-0">Du er ikke med i dette rommet ennå.</p>
        <Form submitText="Bli med" action={chatAction(async () => void await joinRoom(client, roomId))} />
    </>
}
