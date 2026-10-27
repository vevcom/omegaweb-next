import UserDisplayName from '@/components/User/UserDisplayName'
import ProfilePicture from '@/components/User/ProfilePicture'
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
    // A phone has no room for the other columns, so their values go on a line under the name.
    const details = [`@${user.username}`, user.class, user.studyProgramme].filter(Boolean).join(' · ')

    return (
        <>
            <td>
                <div className="flex items-center gap-3">
                    <ProfilePicture profileImage={user.image} width={36} className="size-9 shrink-0" />
                    <div className="min-w-0">
                        {
                            href ? (
                                <Link
                                    href={href}
                                    prefetch={false}
                                    className="
                                        block text-inherit
                                        hover:no-underline
                                    "
                                    onClick={event => event.stopPropagation()}
                                >
                                    {displayName}
                                </Link>
                            ) : displayName
                        }
                        <span className="
                            hidden
                            max-mobile:block
                            text-s text-text-muted
                        ">{details}</span>
                    </div>
                </div>
            </td>
            <td className="max-mobile:hidden">{user.username}</td>
            <td className="max-mobile:hidden">{user.studyProgramme}</td>
            <td className="max-mobile:hidden">{user.class}</td>
            {
                groupSelected && (<>
                    <td className="max-mobile:hidden">{user.selectedGroupInfo?.title}</td>
                    <td className="max-mobile:hidden">{user.selectedGroupInfo?.admin ? 'Ja' : 'Nei'}</td>
                </>)
            }
        </>
    )
}
