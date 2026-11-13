'use client'
import Form from '@/components/Form/Form'
import PopUp from '@/components/PopUp/PopUp'
import UserList from '@/components/User/UserList/UserList'
import UsersSelectionProvider, { UsersSelectionContext } from '@/contexts/UsersSelection'
import { UserPagingProvider } from '@/contexts/paging/UserPaging'
import { configureAction } from '@/services/configureAction'
import { useContext } from 'react'
import type { PopUpKeyType } from '@/contexts/PopUp'
import type { ChatSpaceAdminActions } from '@/services/chat/spaces/types'

type PropTypes = {
    spaceId: number,
    addMembers: NonNullable<ChatSpaceAdminActions['addMembers']>,
    buttonText: string,
}

export default function AddMembersPopUp({ spaceId, addMembers, buttonText }: PropTypes) {
    const popUpKey: PopUpKeyType = `Add members to chat space ${spaceId}`

    return (
        <PopUp
            popUpKey={popUpKey}
            showButtonClass="btn-neutral self-start py-2 px-4 text-s"
            showButtonContent={<>{buttonText}</>}
        >
            <UserPagingProvider
                serverRenderedData={[]}
                startPage={{ page: 0, pageSize: 50 }}
                details={{ groups: [], partOfName: '' }}
            >
                <UsersSelectionProvider>
                    <AddSelectedUsers spaceId={spaceId} addMembers={addMembers} popUpKey={popUpKey} />
                </UsersSelectionProvider>
            </UserPagingProvider>
        </PopUp>
    )
}

function AddSelectedUsers({ spaceId, addMembers, popUpKey }: {
    spaceId: number,
    addMembers: PropTypes['addMembers'],
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
