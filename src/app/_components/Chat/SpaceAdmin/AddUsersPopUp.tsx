'use client'
import Form from '@/components/Form/Form'
import PickUsersPopUp from '@/components/User/UserList/PickUsersPopUp'
import { configureAction } from '@/services/configureAction'
import { useMemo } from 'react'
import type { PopUpKeyType } from '@/contexts/PopUp'
import type { ChatSpaceAdminActions } from '@/services/chat/spaces/types'
import type { UserPageReader } from '@/services/users/types'

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
    const readPage = useMemo((): UserPageReader | undefined => readAddableUsers && (
        ({ params }) => readAddableUsers({ params: { ...params, spaceId } })
    ), [readAddableUsers, spaceId])

    return (
        <PickUsersPopUp popUpKey={popUpKey} buttonText={buttonText} readPage={readPage}>
            {picked => <>
                {whoCanBeAdded && <p className="text-base-content/80 text-s">{whoCanBeAdded}</p>}
                {picked.length > 0 && (
                    <Form
                        submitText={`Legg til ${picked.length} bruker(e)`}
                        action={() => configureAction(addUsers, { params: { spaceId } })({
                            data: { userIds: picked.map(user => user.id) },
                        })}
                        refreshOnSuccess
                        closePopUpOnSuccess={popUpKey}
                    />
                )}
            </>}
        </PickUsersPopUp>
    )
}
