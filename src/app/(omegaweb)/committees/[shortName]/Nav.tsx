import { SubPageNavBar, SubPageNavBarItem } from '@/components/NavBar/SubPageNavBar/SubPageNavBar'
import type { AppNavLink } from '@/lib/navDef/navDef'

type PropTypes = {
    /** The items of `committeeNavDef` the session may open. */
    links: AppNavLink[],
}

export default function Nav({ links }: PropTypes) {
    return (
        <SubPageNavBar>
            {links.map(link => (
                <SubPageNavBarItem key={link.key} icon={link.icon} href={link.href}>{link.name}</SubPageNavBarItem>
            ))}
        </SubPageNavBar>
    )
}
