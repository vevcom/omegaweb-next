'use client'
import { refusalWording } from './chatAction'
import Button from '@/components/UI/Button'
import { joinRoom, leaveRoom, refusalOf } from '@/lib/chatSession/membership'
import { useState } from 'react'
import type { ChatRefusal } from '@/lib/chatSession/membership'
import type { MatrixClient } from 'matrix-js-sdk'

type PropTypes = {
    client: MatrixClient,
    roomId: string,
    /** What the room is called, which says what each button answers. */
    roomName: string,
    onAccepted?: () => void,
}

/**
 * The two answers to an invitation. Accepting joins the room and declining leaves it, and both go
 * from the browser straight to the homeserver.
 */
export default function ChatInvitationAnswer({ client, roomId, roomName, onAccepted }: PropTypes) {
    const [isAnswering, setIsAnswering] = useState(false)
    const [refusal, setRefusal] = useState<ChatRefusal | null>(null)

    const answer = (ask: Promise<unknown>, then?: () => void) => {
        setIsAnswering(true)
        setRefusal(null)
        ask.then(then, (error: unknown) => {
            setRefusal(refusalOf(error))
            setIsAnswering(false)
        })
    }

    return <>
        <Button
            variant="text"
            disabled={isAnswering}
            aria-label={`Godta invitasjonen til ${roomName}`}
            onClick={() => answer(joinRoom(client, roomId), onAccepted)}
        >
            Godta
        </Button>
        <Button
            variant="text"
            color="secondary"
            disabled={isAnswering}
            aria-label={`Avslå invitasjonen til ${roomName}`}
            onClick={() => answer(leaveRoom(client, roomId))}
        >
            Avslå
        </Button>
        <span role="alert" className="text-error">{refusal && refusalWording[refusal]}</span>
    </>
}
