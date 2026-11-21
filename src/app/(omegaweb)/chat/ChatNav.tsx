'use client'
import { SubPageNavBar, SubPageNavBarItem } from '@/components/NavBar/SubPageNavBar/SubPageNavBar'
import useActiveNavHref from '@/hooks/useActiveNavHref'
import type { NavLink } from '@/lib/navDef/navDef'

type PropTypes = {
    /** The items of `chatNavDef` the session may open. */
    links: NavLink[],
}

/** The navigation of the chat pages. An item is active on its own page and on every page under it. */
export default function ChatNav({ links }: PropTypes) {
    const activeHref = useActiveNavHref(links.map(link => link.href))

    return (
        <SubPageNavBar>
            {links.map(link => (
                <SubPageNavBarItem key={link.key} icon={link.icon} href={link.href} active={link.href === activeHref}>
                    {link.name}
                </SubPageNavBarItem>
            ))}
        </SubPageNavBar>
    )
}
