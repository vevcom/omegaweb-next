import SpaceAdmins from './SpaceAdmins'
import SpaceAdmin from '@/components/Chat/SpaceAdmin/SpaceAdmin'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import Form from '@/components/Form/Form'
import { configureAction } from '@/services/configureAction'
import { manualChatSpaceOperations } from '@/services/manualChat/operations'
import { manualChatSpaceAuth } from '@/services/manualChat/auth'
import {
    addManualChatSpaceAdminsAction,
    addManualChatSpaceMembersAction,
    readManualChatSpaceAddableUsersAction,
    addManualChatSpaceRoomMembersAction,
    createManualChatSpaceRoomAction,
    destroyManualChatSpaceAction,
    destroyManualChatSpaceRoomAction,
    removeManualChatSpaceAdminsAction,
    removeManualChatSpaceMembersAction,
    removeManualChatSpaceRoomMembersAction,
    updateManualChatSpaceAction,
    updateManualChatSpaceRoomAction,
} from '@/services/manualChat/actions'
import { serverPage } from '@/app/ServerPage'
import { appHref } from '@/lib/sites/href'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: ({ params }: PageOperationArgs<{ spaceId: string }>) =>
        manualChatSpaceOperations.read({ params: { spaceId: Number(params.spaceId) } }),
    capabilities: ({ admins }) => {
        const adminUserIds = admins.map(admin => admin.id)
        return {
            canUpdate: manualChatSpaceAuth.update,
            canDestroy: manualChatSpaceAuth.destroy,
            canPickAdmins: manualChatSpaceAuth.addAdmins,
            canSetMembers: manualChatSpaceAuth.setMembers.data({ adminUserIds }),
            canSetRooms: manualChatSpaceAuth.setRooms.data({ adminUserIds }),
        }
    },
    metadata: ({ space }) => ({ title: space.name }),
    render: ({ data: { space, rooms, members, admins }, capabilities }) => {
        const ofSpace = { params: { spaceId: space.id } }
        const actions = {
            ...(capabilities.canUpdate.authorized ? { update: updateManualChatSpaceAction } : {}),
            ...(capabilities.canSetMembers.authorized ? {
                readAddableUsers: readManualChatSpaceAddableUsersAction,
                addMembers: addManualChatSpaceMembersAction,
                removeMembers: removeManualChatSpaceMembersAction,
            } : {}),
            ...(capabilities.canSetRooms.authorized ? {
                createRoom: createManualChatSpaceRoomAction,
                updateRoom: updateManualChatSpaceRoomAction,
                destroyRoom: destroyManualChatSpaceRoomAction,
                addRoomMembers: addManualChatSpaceRoomMembersAction,
                removeRoomMembers: removeManualChatSpaceRoomMembersAction,
            } : {}),
        }

        return (
            <PageWrapper>
                <div className="flex flex-col gap-8">
                    <p className="text-base-content/80">
                        Rom og medlemmer bestemmes her. Endringer er på plass i chatten innen et halvt minutt.
                        {!space.onHomeserver && ' Chatområdet opprettes nå.'}
                    </p>
                    <SpaceAdmin space={space} rooms={rooms} members={members} actions={actions} />
                    <SpaceAdmins
                        spaceId={space.id}
                        admins={admins}
                        actions={capabilities.canPickAdmins.authorized ? {
                            addAdmins: addManualChatSpaceAdminsAction,
                            removeAdmins: removeManualChatSpaceAdminsAction,
                        } : undefined}
                    />
                    {capabilities.canDestroy.authorized && (
                        <Form
                            submitText="Slett chatområdet"
                            submitColor="red"
                            action={configureAction(destroyManualChatSpaceAction, ofSpace)}
                            navigateOnSuccess={appHref('/admin/chat-spaces')}
                            confirmation={{
                                confirm: true,
                                text: 'Slette chatområdet? Alle blir tatt ut av det og rommene i det, '
                                    + 'og meldingene blir borte.',
                            }}
                        />
                    )}
                </div>
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }
