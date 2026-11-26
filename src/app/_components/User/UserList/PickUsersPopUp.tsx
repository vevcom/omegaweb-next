'use client'
import UserList from './UserList'
import PopUp from '@/components/PopUp/PopUp'
import UsersSelectionProvider, { UsersSelectionContext } from '@/contexts/UsersSelection'
import { UserPagingProvider } from '@/contexts/paging/UserPaging'
import { useContext, useMemo } from 'react'
import type { PopUpKeyType } from '@/contexts/PopUp'
import type { UserBasic, UserDetails, UserPageReader } from '@/services/users/types'
import type { ReactNode } from 'react'

type PropTypes = {
    popUpKey: PopUpKeyType,
    buttonText: string,
    /** The button that opens the pop-up, where it is not to be the button it is by itself. */
    showButton?: (open: () => void) => ReactNode,
    /** Reads the users to pick among. Left out, they are the user list's own: the active students. */
    readPage?: UserPageReader,
    /** What is done with the picked, shown above the list they are picked from. `unpick` takes one out of them. */
    children: (picked: UserBasic[], unpick: (user: UserBasic) => void) => ReactNode,
}

/** A pop-up where users are picked from the user list, for whatever its children do with them. */
export default function PickUsersPopUp({ popUpKey, buttonText, showButton, readPage, children }: PropTypes) {
    // The same object across renders, since the list starts over when its details are replaced.
    const listDetails = useMemo((): UserDetails => ({ groups: [], partOfName: '', readPage }), [readPage])

    return (
        <PopUp
            popUpKey={popUpKey}
            customShowButton={showButton}
            showButtonClass="btn-neutral self-start py-2 px-4 text-s"
            showButtonContent={<>{buttonText}</>}
        >
            <UserPagingProvider
                serverRenderedData={[]}
                startPage={{ page: 0, pageSize: 50 }}
                details={listDetails}
            >
                <UsersSelectionProvider>
                    <div className="flex flex-col gap-2 min-w-[min(80vw,700px)]">
                        <Picked>{children}</Picked>
                        <UserList />
                    </div>
                </UsersSelectionProvider>
            </UserPagingProvider>
        </PopUp>
    )
}

function Picked({ children }: Pick<PropTypes, 'children'>) {
    const selection = useContext(UsersSelectionContext)
    return children(selection?.users ?? [], user => selection?.removeUser(user))
}
