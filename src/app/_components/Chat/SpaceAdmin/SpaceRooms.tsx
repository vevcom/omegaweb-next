'use client'
import Tag from './Tag'
import PrivateRoomMembers from './PrivateRoomMembers'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import Slider from '@/components/UI/Slider'
import { configureAction } from '@/services/configureAction'
import type {
    ChatSpaceAdminActions,
    ChatSpaceMemberOverview,
    ChatSpaceRoomOverview,
} from '@/services/chat/spaces/types'

type PropTypes = {
    spaceId: number,
    rooms: ChatSpaceRoomOverview[],
    spaceMembers: ChatSpaceMemberOverview[],
    actions: Pick<
        ChatSpaceAdminActions,
        'createRoom' | 'updateRoom' | 'destroyRoom' | 'addRoomMembers' | 'removeRoomMembers'
    >,
}

export default function SpaceRooms({ spaceId, rooms, spaceMembers, actions }: PropTypes) {
    const { createRoom, updateRoom, destroyRoom } = actions

    return (
        <section className="flex flex-col gap-2">
            <h2>Rom</h2>
            {rooms.length === 0 && <p className="text-base-content/80 italic">Chatområdet har ingen rom.</p>}
            {rooms.map(room => {
                const ofRoom = { params: { spaceId, roomId: room.id } }
                return (
                    <div key={room.id} className="flex flex-col gap-2 py-2 px-4 rounded-round layer">
                        <div
                            className="
                                flex flex-row items-center gap-4
                                max-mobile:flex-col max-mobile:items-stretch
                                [&_form>*:last-child]:mt-0
                            "
                        >
                            {updateRoom ? (
                                <Form
                                    className="flex flex-row items-center gap-2 w-auto! grow"
                                    submitText="Lagre"
                                    submitColor="secondary"
                                    action={configureAction(updateRoom, ofRoom)}
                                    refreshOnSuccess
                                >
                                    <TextInput name="name" label="Navn" defaultValue={room.name} />
                                </Form>
                            ) : (
                                <span className="grow truncate">{room.name}</span>
                            )}
                            {room.isPrivate && <Tag>Privat</Tag>}
                            {!room.onHomeserver && <Tag>Opprettes</Tag>}
                            {destroyRoom && (
                                <Form
                                    className="w-auto!"
                                    submitText="Slett"
                                    submitColor="red"
                                    action={configureAction(destroyRoom, ofRoom)}
                                    refreshOnSuccess
                                    confirmation={{
                                        confirm: true,
                                        text: `Slette rommet ${room.name}? `
                                            + 'Alle blir tatt ut av det, og meldingene blir borte.',
                                    }}
                                />
                            )}
                        </div>
                        {room.isPrivate && (
                            <PrivateRoomMembers
                                spaceId={spaceId}
                                room={room}
                                spaceMembers={spaceMembers}
                                actions={actions}
                            />
                        )}
                    </div>
                )
            })}
            {createRoom && (
                <Form
                    title="Nytt rom"
                    submitText="Opprett"
                    action={configureAction(createRoom, { params: { spaceId } })}
                    refreshOnSuccess
                >
                    <TextInput name="name" label="Navn" />
                    <Slider name="isPrivate" label="Privat, bare for dem som legges til" />
                </Form>
            )}
        </section>
    )
}
