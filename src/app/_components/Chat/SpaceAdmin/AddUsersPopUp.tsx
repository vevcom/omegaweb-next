'use client'
import Form from '@/components/Form/Form'
import PopUp from '@/components/PopUp/PopUp'
import UserList from '@/components/User/UserList/UserList'
import UsersSelectionProvider, { UsersSelectionContext } from '@/contexts/UsersSelection'
import { UserPagingProvider } from '@/contexts/paging/UserPaging'
import { configureAction } from '@/services/configureAction'
import { useContext, useMemo } from 'react'
import type { PopUpKeyType } from '@/contexts/PopUp'
import type { ChatSpaceAdminActions } from '@/services/chat/spaces/types'
import type { UserDetails } from '@/services/users/types'

/** Any action that takes a space and some users, such as adding them to it or picking them as its admins. */
export type UsersOfSpaceAction = NonNullable<ChatSpaceAdminActions['addMembers']>

type PropTypes = {
    spaceId: number,
    addUsers: UsersOfSpaceAction,
    buttonText: string,
    whoCanBeAdded?: string,
    /** Reads the users to pick among. Left out, they are the user list's own: the active students. */
    readAddableUsers?: ChatSpaceAdminActions['readAddableUsers'],
}

export default function AddUsersPopUp({ spaceId, addUsers, buttonText, whoCanBeAdded, readAddableUsers }: PropTypes) {
    const popUpKey: PopUpKeyType = `${buttonText} in chat space ${spaceId}`
    // The same object across renders, since the list starts over when its details are replaced.
    const listDetails = useMemo((): UserDetails => ({
        groups: [],
        partOfName: '',
        readPage: readAddableUsers && (({ params }) => readAddableUsers({ params: { ...params, spaceId } })),
    }), [readAddableUsers, spaceId])

    return (
        <PopUp
            popUpKey={popUpKey}
            showButtonClass="btn-neutral self-start py-2 px-4 text-s"
            showButtonContent={<>{buttonText}</>}
        >
            <UserPagingProvider
                serverRenderedData={[]}
                startPage={{ page: 0, pageSize: 50 }}
                details={listDetails}
            >
                <UsersSelectionProvider>
                    <AddSelectedUsers
                        spaceId={spaceId}
                        addUsers={addUsers}
                        popUpKey={popUpKey}
                        whoCanBeAdded={whoCanBeAdded}
                    />
                </UsersSelectionProvider>
            </UserPagingProvider>
        </PopUp>
    )
}

function AddSelectedUsers({ spaceId, addUsers, popUpKey, whoCanBeAdded }: {
    spaceId: number,
    addUsers: UsersOfSpaceAction,
    popUpKey: PopUpKeyType,
    whoCanBeAdded?: string,
}) {
    const selectedUsers = useContext(UsersSelectionContext)?.users ?? []

    return (
        <div className="flex flex-col gap-2 min-w-[min(80vw,700px)]">
            {whoCanBeAdded && <p className="text-base-content/80 text-s">{whoCanBeAdded}</p>}
            {selectedUsers.length > 0 && (
                <Form
                    submitText={`Legg til ${selectedUsers.length} bruker(e)`}
                    action={() => configureAction(addUsers, { params: { spaceId } })({
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
