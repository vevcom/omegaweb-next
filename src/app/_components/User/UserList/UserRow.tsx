import UserDisplayName from '@/components/User/UserDisplayName'
import SiteLink from '@/components/SiteLink/SiteLink'
import type { UserPagingReturn } from '@/services/users/types'
import type { AppHref } from '@/lib/sites/href'

type PropTypes = {
    user: UserPagingReturn
    groupSelected?: boolean,
    /**
     * Makes the name a link to this href. Clicks on it do not propagate, so a clickable
     * row around it does not navigate a second time.
     */
    href?: AppHref,
}

export default function UserRow({ user, groupSelected = false, href }: PropTypes) {
    const displayName = <UserDisplayName width={16} user={user} />

    return (
        <>
            <td>
                {
                    href ? (
                        <SiteLink
                            href={href}
                            prefetch={false}
                            className="
                                block text-inherit
                                hover:no-underline
                            "
                            onClick={event => event.stopPropagation()}
                        >
                            {displayName}
                        </SiteLink>
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
