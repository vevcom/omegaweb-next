'use client'
import styles from './AddUserToMailingList.module.scss'
import UserList from '@/components/User/UserList/UserList'
import { UserSelectionContext } from '@/contexts/UserSelection'
import { createMailingListUserRelationAction } from '@/services/mail/actions'
import { useRouter } from 'next/navigation'
import { useContext, useState } from 'react'

/**
 * Adds a user to the mailing list by picking them from the user list - selecting a row adds
 * that user right away. Must be rendered inside UserSelectionProvider and UserPagingProvider.
 */
export default function AddUserToMailingList({ mailingListId }: { mailingListId: number }) {
    const userSelection = useContext(UserSelectionContext)
    const { refresh } = useRouter()
    const [error, setError] = useState<string | null>(null)

    if (!userSelection) throw new Error('UserSelectionContext kreves for å legge brukere til en e-postliste')

    userSelection.onSelection(async user => {
        if (!user) return
        const result = await createMailingListUserRelationAction({
            data: { mailingListId, userId: user.id },
        })
        if (!result.success) {
            setError(`Kunne ikke legge til ${user.firstname} ${user.lastname}.`)
            return
        }
        setError(null)
        refresh()
    })

    return <div className={styles.addUser}>
        <h3>Legg til bruker</h3>
        <p>Trykk på en bruker for å legge dem til e-postlisten.</p>
        {error && <p className={styles.error}>{error}</p>}
        <UserList linksToUser={false} />
    </div>
}
