import styles from './UserRow.module.scss'
import UserDisplayName from '@/components/User/UserDisplayName'
import Link from 'next/link'
import type { UserPagingReturn } from '@/services/users/types'

type PropTypes = {
    user: UserPagingReturn
    groupSelected?: boolean,
    /**
     * Makes the name a link to this href. Clicks on it do not propagate, so a clickable
     * row around it does not navigate a second time.
     */
    href?: string,
}

export default function UserRow({ user, groupSelected = false, href }: PropTypes) {
    const displayName = <UserDisplayName width={16} user={user} />

    return (
        <>
            <td>
                {
                    href ? (
                        <Link
                            href={href}
                            prefetch={false}
                            className={styles.link}
                            onClick={event => event.stopPropagation()}
                        >
                            {displayName}
                        </Link>
                    ) : displayName
                }
            </td>
            <td>{user.username}</td>
            <td>{user.studyProgramme}</td>
            <td>{user.class}</td>
            {
                groupSelected && (<>
                    <td>{user.selectedGroupInfo?.title}</td>
                    <td>{user.selectedGroupInfo?.admin ? 'Ja' : 'Nei'}</td>
                </>)
            }
        </>
    )
}
