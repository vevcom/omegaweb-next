'use client'
import ChatInvitationAnswer from './ChatInvitationAnswer'
import { refusalWording } from './chatAction'
import ChatComposer from '@/components/Chat/Room/ChatComposer'
import { useChatSession } from '@/components/Chat/Session/ChatSessionProvider'
import Button from '@/components/UI/Button'
import { refusalOf, startDirectMessage } from '@/lib/chatSession/membership'
import { directInvitationFrom } from '@/lib/chatSession/rooms'
import { watchAtSync } from '@/lib/chatSession/watch'
import { useMemo, useState, useSyncExternalStore } from 'react'
import type { ChatRefusal } from '@/lib/chatSession/membership'
import type { MatrixClient } from 'matrix-js-sdk'

type PropTypes = {
    /** The Matrix id of the one to write to, and what the app calls them. */
    matrixUserId: string,
    name: string,
    firstname: string,
}

/**
 * What is shown in place of the direct message with a user while the two have none. Where the
 * other has asked the user into one, it is that invitation to answer. Otherwise it is where the
 * first message is written, and that message is what makes the room.
 */
export default function StartDirectMessage(props: PropTypes) {
    const { state } = useChatSession()
    return state.status === 'RUNNING' ? <StartInRunningSession client={state.client} {...props} /> : null
}

function StartInRunningSession({ client, matrixUserId, name, firstname }: PropTypes & { client: MatrixClient }) {
    const watched = useMemo(
        () => watchAtSync(client, () => directInvitationFrom(client, matrixUserId)),
        [client, matrixUserId],
    )
    const invitation = useSyncExternalStore(watched.subscribe, watched.read)
    const [first, setFirst] = useState<{ text: string, refusal: ChatRefusal | null } | null>(null)

    const start = (text: string) => {
        setFirst({ text, refusal: null })
        // A room that is the direct message with them is shown in place of this. One they declined before it was is not.
        startDirectMessage(client, matrixUserId, text)
            .then(() => setFirst(null), (error: unknown) => setFirst({ text, refusal: refusalOf(error) }))
    }

    if (invitation) {
        return <>
            <p className="m-0">{firstname} har invitert deg til en direktemelding.</p>
            <div className="flex flex-row flex-wrap items-baseline gap-x-3 gap-y-1">
                <ChatInvitationAnswer client={client} roomId={invitation.roomId} roomName={name} />
            </div>
        </>
    }
    if (first && !first.refusal) return <p className="m-0 text-base-content/80" role="status">Starter samtalen ...</p>
    return <>
        <p className="m-0">
            Du har ingen direktemelding med {firstname} ennå. Den starter når du sender den første meldingen.
        </p>
        {first?.refusal && (
            <div className="flex flex-col items-start gap-1">
                <p className="m-0 whitespace-pre-wrap wrap-anywhere">{first.text}</p>
                <p className="m-0 text-error" role="alert">Meldingen ble ikke sendt. {refusalWording[first.refusal]}</p>
                <Button variant="text" onClick={() => start(first.text)}>Prøv igjen</Button>
            </div>
        )}
        <ChatComposer roomName={name} onSend={start} />
    </>
}
