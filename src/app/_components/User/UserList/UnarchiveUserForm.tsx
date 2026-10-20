'use client'
import Form from '@/components/Form/Form'
import { UserPagingContext } from '@/contexts/paging/UserPaging'
import { configureAction } from '@/services/configureAction'
import { unarchiveUserAction } from '@/services/users/actions'
import { useContext } from 'react'

/**
 * Lets an archived user back in, and reloads the list it sits in.
 */
export default function UnarchiveUserForm({ userId }: { userId: number }) {
    const userPaging = useContext(UserPagingContext)

    return (
        <Form
            action={configureAction(unarchiveUserAction, { params: { id: userId } })}
            submitText="Åpne igjen"
            submitColor="secondary"
            confirmation={{ confirm: true, text: 'Brukeren kan da logge inn igjen.' }}
            successCallback={() => userPaging?.refetch()}
        />
    )
}
