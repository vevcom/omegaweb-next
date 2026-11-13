'use client'
import SpaceRooms from './SpaceRooms'
import SpaceMembers from './SpaceMembers'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { configureAction } from '@/services/configureAction'
import type {
    ChatSpaceAdminActions,
    ChatSpaceMemberOverview,
    ChatSpaceRoomOverview,
} from '@/services/chat/spaces/types'

type PropTypes = {
    space: { id: number, name: string },
    rooms: ChatSpaceRoomOverview[],
    members: ChatSpaceMemberOverview[],
    actions: ChatSpaceAdminActions,
}

export default function SpaceAdmin({ space, rooms, members, actions }: PropTypes) {
    return (
        <div className="flex flex-col gap-8">
            {actions.update && (
                <Form
                    title="Navn"
                    submitText="Lagre"
                    action={configureAction(actions.update, { params: { spaceId: space.id } })}
                    refreshOnSuccess
                >
                    <TextInput name="name" label="Navn" defaultValue={space.name} />
                </Form>
            )}
            <SpaceRooms spaceId={space.id} rooms={rooms} spaceMembers={members} actions={actions} />
            <SpaceMembers spaceId={space.id} members={members} actions={actions} />
        </div>
    )
}
