'use client'
import { chatAction, refusalWording } from './chatAction'
import useChatUsersToPick from './useChatUsersToPick'
import { chatLinks } from '@/app/(omegaweb)/chat/links'
import Form from '@/components/Form/Form'
import PopUp from '@/components/PopUp/PopUp'
import SiteLink from '@/components/SiteLink/SiteLink'
import Button from '@/components/UI/Button'
import PickUsersPopUp from '@/components/User/UserList/PickUsersPopUp'
import useAuthorizer from '@/hooks/useAuthorizer'
import useSiteRouter from '@/hooks/useSiteRouter'
import { MAX_INVITED_AT_ONCE, inviteToRoom, leaveRoom } from '@/lib/chatSession/membership'
import { kindOf } from '@/lib/chatSession/rooms'
import { createActionError } from '@/services/actionError'
import { chatUserAuth } from '@/services/chat/users/auth'
import { useState } from 'react'
import type { AppHref } from '@/lib/sites/href'
import type { ActionReturn } from '@/services/actionTypes'
import type { UserBasic } from '@/services/users/types'
import type { MatrixClient, Room } from 'matrix-js-sdk'

/** What a room of a space is here, where the room is one. */
export type RoomOfSpace = { name: string, isPrivate: boolean }

type PropTypes = {
    client: MatrixClient,
    room: Room,
    ofSpace?: RoomOfSpace,
}

/**
 * What the user does with an open room besides writing in it: goes back to where it is listed,
 * asks more into a group where the room lets them and they may read those to pick from, and leaves
 * it. A room of a space is the app's: who is in it is set there and the homeserver refuses an
 * invitation from anyone else, so nobody is asked in from here. A private one is not left either,
 * since the chat sync puts those picked for it back.
 */
export default function ChatRoomActions({ client, room, ofSpace }: PropTypes) {
    const listedAt = ofSpace ? chatLinks.spaces() : chatLinks.messages()
    const canPick = useAuthorizer({ authorizer: chatUserAuth.readPage }).authorized
    const canInvite = !ofSpace && canPick && kindOf(room) === 'GROUP' && room.canInvite(client.getSafeUserId())

    return (
        <div className="flex flex-row flex-wrap items-baseline gap-x-4 gap-y-1">
            <SiteLink href={listedAt}>{ofSpace ? 'Alle chatområder' : 'Alle meldinger'}</SiteLink>
            {canInvite && <InviteMore client={client} roomId={room.roomId} />}
            {!ofSpace?.isPrivate && (
                <PopUp
                    popUpKey={`leave chat room ${room.roomId}`}
                    customShowButton={open => <Button variant="text" onClick={open}>Forlat</Button>}
                >
                    <Leave client={client} roomId={room.roomId} listedAt={listedAt} isOfSpace={Boolean(ofSpace)} />
                </PopUp>
            )}
        </div>
    )
}

/**
 * Those the homeserver has answered for are taken out of the picked, so what is left picked is
 * who was not asked in, and asking again asks only them.
 */
function InviteMore({ client, roomId }: { client: MatrixClient, roomId: string }) {
    const { readPage, matrixIdOf } = useChatUsersToPick()
    const [outcome, setOutcome] = useState('')
    const popUpKey = `invite to chat room ${roomId}`

    const invite = async (picked: UserBasic[], unpick: (user: UserBasic) => void): Promise<ActionReturn> => {
        const ids = picked.flatMap(user => matrixIdOf(user) ?? [])
        const { invited, refused, stoppedBy } = await inviteToRoom(client, roomId, ids)
        if (invited.length === picked.length) return { success: true, data: undefined }
        const among = (answered: string[]) => picked.filter(user => answered.includes(matrixIdOf(user) ?? ''))
        const said = [
            `${invited.length} ble invitert.`,
            refused.length > 0 && `Er med fra før, eller kan ikke inviteres: ${among(refused).map(nameOf).join(', ')}.`,
            stoppedBy && `${refusalWording[stoppedBy]} De som fortsatt er valgt, er ikke invitert.`,
        ].filter(Boolean).join(' ')
        among([...invited, ...refused]).forEach(unpick)
        setOutcome(said)
        return createActionError('SERVER ERROR', said)
    }

    return (
        <PickUsersPopUp
            popUpKey={popUpKey}
            buttonText="Inviter flere"
            showButton={open => <Button variant="text" onClick={open}>Inviter flere</Button>}
            readPage={readPage}
        >
            {(picked, unpick) => {
                if (picked.length === 0) {
                    return (
                        <p className="m-0 text-base-content/80" role="status">{outcome || 'Velg hvem du vil invitere.'}</p>
                    )
                }
                if (picked.length > MAX_INVITED_AT_ONCE) {
                    return <p className="m-0" role="alert">Du kan invitere høyst {MAX_INVITED_AT_ONCE} om gangen.</p>
                }
                return (
                    <Form
                        submitText={`Inviter ${picked.length}`}
                        action={() => invite(picked, unpick)}
                        closePopUpOnSuccess={popUpKey}
                    />
                )
            }}
        </PickUsersPopUp>
    )
}

function Leave({ client, roomId, listedAt, isOfSpace }: {
    client: MatrixClient,
    roomId: string,
    listedAt: AppHref,
    isOfSpace: boolean,
}) {
    const { push } = useSiteRouter()

    return (
        <div className="flex flex-col gap-3 w-[min(80vw,24rem)]">
            <h2 className="m-0">Forlate samtalen?</h2>
            <p className="m-0">
                {isOfSpace
                    ? 'Du kan bli med igjen fra chatområdet.'
                    : 'Du kan ikke lese eller skrive her igjen før noen inviterer deg på nytt.'}
            </p>
            <Form
                submitText="Forlat"
                submitColor="red"
                action={chatAction(async () => {
                    await leaveRoom(client, roomId)
                    push(listedAt)
                })}
            />
        </div>
    )
}

function nameOf(user: UserBasic): string {
    return `${user.firstname} ${user.lastname}`
}
