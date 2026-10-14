import { SubPageNavBar, SubPageNavBarItem } from '@/components/NavBar/SubPageNavBar/SubPageNavBar'
import { visibleUserNavItems } from '@/app/(omegaweb)/users/[username]/userNavDef'
import { ServerSession } from '@/auth/session/ServerSession'
import type { UserNavSubject } from '@/app/(omegaweb)/users/[username]/userNavDef'

/**
 * The nav for a user's pages. Each item carries the authorizers of the page it points at, so what
 * is shown is what the session may actually open - which is not only the user themselves, since
 * administrators reach several of these pages for other people.
 */
export default async function UserNavBar({ username, userId }: UserNavSubject) {
    const session = await ServerSession.fromNextAuth()
    const items = visibleUserNavItems(
        { username, userId },
        authorizer => authorizer.auth(session).authorized,
    )

    // only view one thing -> nav not needed
    if (items.length < 2) return null

    return (
        <SubPageNavBar>
            {items.map(item => (
                <SubPageNavBarItem
                    key={item.name}
                    icon={item.icon}
                    href={`/users/${username}${item.path ? `/${item.path}` : ''}`}
                >
                    {item.name}
                </SubPageNavBarItem>
            ))}
        </SubPageNavBar>
    )
}
