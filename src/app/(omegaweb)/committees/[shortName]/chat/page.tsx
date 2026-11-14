import ChatSpacePeople from './ChatSpacePeople'
import getCommittee from '@/app/(omegaweb)/committees/[shortName]/getCommittee'
import SpaceAdmin from '@/components/Chat/SpaceAdmin/SpaceAdmin'
import Form from '@/components/Form/Form'
import { configureAction } from '@/services/configureAction'
import {
    addCommitteeChatSpaceMembersAction,
    readCommitteeChatSpaceAddableUsersAction,
    addCommitteeChatSpaceRoomMembersAction,
    createCommitteeChatSpaceAction,
    createCommitteeChatSpaceRoomAction,
    destroyCommitteeChatSpaceAction,
    destroyCommitteeChatSpaceRoomAction,
    removeCommitteeChatSpaceMembersAction,
    removeCommitteeChatSpaceRoomMembersAction,
    updateCommitteeChatSpaceRoomAction,
} from '@/services/groups/committees/actions'
import { committeeChatSpaceOperations } from '@/services/groups/committees/chatSpace'
import { committeeAuth } from '@/services/groups/committees/auth'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ shortName: string }>) => {
        const committee = await getCommittee(params.shortName)
        const chatSpace = await committeeChatSpaceOperations.read({ params: { groupId: committee.groupId } })
        return { committee, chatSpace }
    },
    capabilities: ({ committee: { groupId } }) => ({
        canCreate: committeeAuth.createChatSpace.data({ groupId }),
        canDestroy: committeeAuth.destroyChatSpace.data({ groupId }),
        canSetMembers: committeeAuth.setChatSpaceMembers.data({ groupId }),
        canSetRooms: committeeAuth.setChatSpaceRooms.data({ groupId }),
    }),
    metadata: ({ committee }) => ({ title: `Chat for ${committee.name}` }),
    render: ({ data: { committee, chatSpace }, capabilities }) => {
        const ofCommittee = { implementationParams: { groupId: committee.groupId } }

        if (!chatSpace) {
            return (
                <div className="flex flex-col gap-4">
                    <h2>Chat</h2>
                    <p>
                        {committee.name} har ikke noe chatområde. Et chatområde er komiteens egne rom på chatten, der
                        de aktive medlemmene er med av seg selv.
                    </p>
                    {capabilities.canCreate.authorized && !committee.group.pensioned && (
                        <Form
                            submitText="Opprett chatområde"
                            action={configureAction(createCommitteeChatSpaceAction, {
                                params: { groupId: committee.groupId },
                            })}
                            refreshOnSuccess
                        />
                    )}
                </div>
            )
        }

        const { space, rooms, members, people } = chatSpace
        const membersActions = capabilities.canSetMembers.authorized ? {
            readAddableUsers: configureAction(readCommitteeChatSpaceAddableUsersAction, ofCommittee),
            addMembers: configureAction(addCommitteeChatSpaceMembersAction, ofCommittee),
            removeMembers: configureAction(removeCommitteeChatSpaceMembersAction, ofCommittee),
        } : {}
        const roomsActions = capabilities.canSetRooms.authorized ? {
            createRoom: configureAction(createCommitteeChatSpaceRoomAction, ofCommittee),
            updateRoom: configureAction(updateCommitteeChatSpaceRoomAction, ofCommittee),
            destroyRoom: configureAction(destroyCommitteeChatSpaceRoomAction, ofCommittee),
            addRoomMembers: configureAction(addCommitteeChatSpaceRoomMembersAction, ofCommittee),
            removeRoomMembers: configureAction(removeCommitteeChatSpaceRoomMembersAction, ofCommittee),
        } : {}

        return (
            <div className="flex flex-col gap-8">
                <header className="
                    flex flex-col gap-2
                    [&_h2]:m-0
                ">
                    <h2>Chat for {committee.name}</h2>
                    <p className="text-base-content/80">
                        Rom og medlemmer bestemmes her. Endringer er på plass i chatten innen et halvt minutt.
                        {!space.onHomeserver && ' Chatområdet opprettes nå.'}
                    </p>
                </header>
                <SpaceAdmin
                    space={space}
                    rooms={rooms}
                    members={members}
                    actions={roomsActions}
                    membersSection={<ChatSpacePeople spaceId={space.id} people={people} actions={membersActions} />}
                />
                {capabilities.canDestroy.authorized && (
                    <Form
                        submitText="Slett chatområdet"
                        submitColor="red"
                        action={configureAction(configureAction(destroyCommitteeChatSpaceAction, ofCommittee), {
                            params: { spaceId: space.id },
                        })}
                        refreshOnSuccess
                        confirmation={{
                            confirm: true,
                            text: 'Slette chatområdet? Alle blir tatt ut av det og rommene i det, og meldingene blir borte.',
                        }}
                    />
                )}
            </div>
        )
    },
})

export default page
export { generateMetadata }
