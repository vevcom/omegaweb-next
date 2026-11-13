'use client'
import WaitingForChatTag from './WaitingForChatTag'
import Form from '@/components/Form/Form'
import PopUp from '@/components/PopUp/PopUp'
import UserList from '@/components/User/UserList/UserList'
import UsersSelectionProvider, { UsersSelectionContext } from '@/contexts/UsersSelection'
import { UserPagingProvider } from '@/contexts/paging/UserPaging'
import { configureAction } from '@/services/configureAction'
import { useContext } from 'react'
import type { PopUpKeyType } from '@/contexts/PopUp'
import type { ChatSpaceAdminActions, ChatSpaceMemberOverview } from '@/services/chat/spaces/types'

type PropTypes = {
    spaceId: number,
    members: ChatSpaceMemberOverview[],
    actions: Pick<ChatSpaceAdminActions, 'addMembers' | 'removeMembers'>,
}

export default function SpaceMembers({ spaceId, members, actions }: PropTypes) {
    const { addMembers, removeMembers } = actions
    const addPopUpKey: PopUpKeyType = `Add members to chat space ${spaceId}`

    return (
        <section className="flex flex-col gap-2">
            <h2>Medlemmer</h2>
            {addMembers && (
                <PopUp
                    popUpKey={addPopUpKey}
                    showButtonClass="btn-neutral self-start py-2 px-4 text-s"
                    showButtonContent={<>Legg til medlemmer</>}
                >
                    <UserPagingProvider
                        serverRenderedData={[]}
                        startPage={{ page: 0, pageSize: 50 }}
                        details={{ groups: [], partOfName: '' }}
                    >
                        <UsersSelectionProvider>
                            <AddSelectedUsers spaceId={spaceId} addMembers={addMembers} popUpKey={addPopUpKey} />
                        </UsersSelectionProvider>
                    </UserPagingProvider>
                </PopUp>
            )}
            {members.length === 0 && <p className="text-base-content/80 italic">Chatområdet har ingen medlemmer.</p>}
            {members.map(member => {
                const name = `${member.firstname} ${member.lastname}`
                return (
                    <div
                        key={member.id}
                        className="
                            flex flex-row items-center gap-4 py-2 px-4 rounded-round layer
                            [&_form>*:last-child]:mt-0
                        "
                    >
                        <span className="grow truncate">{name}</span>
                        {!member.onHomeserver && <WaitingForChatTag>Venter på chatkonto</WaitingForChatTag>}
                        {removeMembers && (
                            <Form
                                className="w-auto!"
                                submitText="Fjern"
                                submitColor="red"
                                action={configureAction(removeMembers, { params: { spaceId } })}
                                refreshOnSuccess
                                confirmation={{ confirm: true, text: `Fjerne ${name} fra chatområdet og rommene i det?` }}
                            >
                                <input type="hidden" name="userIds" value={member.id} />
                            </Form>
                        )}
                    </div>
                )
            })}
        </section>
    )
}

function AddSelectedUsers({ spaceId, addMembers, popUpKey }: {
    spaceId: number,
    addMembers: NonNullable<ChatSpaceAdminActions['addMembers']>,
    popUpKey: PopUpKeyType,
}) {
    const selectedUsers = useContext(UsersSelectionContext)?.users ?? []

    return (
        <div className="flex flex-col gap-2 min-w-[min(80vw,700px)]">
            <p className="text-base-content/80 text-s">Bare de som har logget inn på chatten kan legges til.</p>
            {selectedUsers.length > 0 && (
                <Form
                    submitText={`Legg til ${selectedUsers.length} bruker(e)`}
                    action={() => configureAction(addMembers, { params: { spaceId } })({
                        data: { userIds: selectedUsers.map(user => user.id) },
                    })}
                    refreshOnSuccess
                    closePopUpOnSuccess={popUpKey}
                />
            )}
            <UserList />
        </div>
    )
}
