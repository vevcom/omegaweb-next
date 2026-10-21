import Button from '@/components/UI/Button'
import { userNavHref, visibleUserNavItems } from '@/app/users/[username]/userNavDef'
import { ServerSession } from '@/auth/session/ServerSession'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faCog } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'
import type { UserNavSubject } from '@/app/users/[username]/userNavDef'

/**
 * The settings group of a user's pages, as one button for the profile to show under its log out
 * button, which unfolds into a button per page.
 */
export default async function UserSettingsNav({ username, userId }: UserNavSubject) {
    const session = await ServerSession.fromNextAuth()
    const items = visibleUserNavItems(
        'settings',
        { username, userId },
        authorizer => authorizer.auth(session).authorized,
    )

    if (items.length === 0) return null

    return (
        <details className="group">
            <summary className="
                secondary-btn flex items-center gap-[0.5em] list-none
                [&::-webkit-details-marker]:hidden
            ">
                <FontAwesomeIcon icon={faCog} />
                <p className="w-[6.25em]">Innstillinger</p>
                <FontAwesomeIcon icon={faChevronDown} className="
                    transition-transform duration-300
                    group-open:rotate-180
                " />
            </summary>
            <div className="flex flex-col items-center gap-2">
                {items.map(item => (
                    <Link key={item.name} href={userNavHref(username, item)}>
                        <Button color="secondary" className="flex! items-center! gap-[0.5em]!">
                            <FontAwesomeIcon icon={item.icon} />
                            <p className="w-[8em]">{item.name}</p>
                        </Button>
                    </Link>
                ))}
            </div>
        </details>
    )
}
