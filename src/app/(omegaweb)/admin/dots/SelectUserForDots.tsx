'use client'
import UserList from '@/components/User/UserList/UserList'
import { UserSelectionContext } from '@/contexts/UserSelection'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { useRouter } from 'next/navigation'
import { useContext } from 'react'

/**
 * The user list of the dot admin page. Selecting a user in it puts that user in the query params,
 * which is where the page reads which user to show the dots of.
 */
export default function SelectUserForDots() {
    const userSelection = useContext(UserSelectionContext)
    const { push } = useRouter()

    if (!userSelection) throw new Error('UserSelectionContext kreves for å velge en bruker for prikker')

    userSelection.onSelection(user => {
        if (!user) return
        push(`/admin/dots?${QueryParams.userId.encodeUrl(user.id)}`)
    })

    return <UserList linksToUser={false} />
}
