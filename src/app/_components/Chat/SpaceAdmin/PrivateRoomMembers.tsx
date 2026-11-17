'use client'
import Form from '@/components/Form/Form'
import { SelectNumber } from '@/components/UI/Select'
import { configureAction } from '@/services/configureAction'
import type {
    ChatSpaceAdminActions,
    ChatSpaceMemberOverview,
    ChatSpaceRoomOverview,
} from '@/services/chat/spaces/types'

type PropTypes = {
    spaceId: number,
    room: ChatSpaceRoomOverview,
    spaceMembers: ChatSpaceMemberOverview[],
    actions: Pick<ChatSpaceAdminActions, 'addRoomMembers' | 'removeRoomMembers'>,
}

const nameOf = (user: { firstname: string, lastname: string }) => `${user.firstname} ${user.lastname}`

export default function PrivateRoomMembers({ spaceId, room, spaceMembers, actions }: PropTypes) {
    const { addRoomMembers, removeRoomMembers } = actions
    const ofRoom = { params: { spaceId, roomId: room.id } }
    const spaceMembersNotPicked = spaceMembers.filter(
        spaceMember => !room.pickedMembers.some(pickedMember => pickedMember.id === spaceMember.id)
    )

    return (
        <div className="
            flex flex-col gap-1
            [&_form>*:last-child]:mt-0
        ">
            {room.pickedMembers.length === 0 && (
                <p className="text-base-content/80 italic text-s">Ingen er lagt til i rommet.</p>
            )}
            {room.pickedMembers.map(pickedMember => (
                <div key={pickedMember.id} className="flex flex-row items-center gap-4">
                    <span className="grow truncate">{nameOf(pickedMember)}</span>
                    {removeRoomMembers && (
                        <Form
                            className="w-auto!"
                            submitText="Fjern"
                            submitColor="red"
                            action={configureAction(removeRoomMembers, ofRoom)}
                            refreshOnSuccess
                        >
                            <input type="hidden" name="userIds" value={pickedMember.id} />
                        </Form>
                    )}
                </div>
            ))}
            {addRoomMembers && spaceMembersNotPicked.length > 0 && (
                <Form
                    // The select keeps its choice, which is no longer among the options once it is added.
                    key={spaceMembersNotPicked.length}
                    className="flex flex-row items-center gap-2 w-auto!"
                    submitText="Legg til"
                    submitColor="secondary"
                    action={configureAction(addRoomMembers, ofRoom)}
                    refreshOnSuccess
                >
                    <SelectNumber
                        name="userIds"
                        label="Medlem av chatområdet"
                        options={spaceMembersNotPicked.map(spaceMember => ({
                            value: spaceMember.id,
                            label: nameOf(spaceMember),
                        }))}
                    />
                </Form>
            )}
        </div>
    )
}
