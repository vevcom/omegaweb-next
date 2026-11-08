import { SideBarNavItem } from '@ohma/ui'
import { faCalendar, faCamera, faComment, faNewspaper } from '@fortawesome/free-solid-svg-icons'
import type { ReactNode } from 'react'

const items = [
    { name: 'Hvad der hender', href: '/events', show: 'all' as const, icon: faCalendar },
    { name: 'Nyheter', href: '/news', show: 'all' as const, icon: faNewspaper },
    { name: 'Bilder', href: '/image-collections', show: 'all' as const, icon: faCamera },
    { name: 'Omegaquotes', href: '/omegaquotes', show: 'loggedIn' as const, icon: faComment },
]

const Rail = ({ children }: { children: ReactNode }) => (
    <nav style={{
        width: '4.5rem',
        display: 'grid',
        gap: '0.25rem',
        padding: '0.75rem',
        background: 'var(--color-base-200)',
        borderRadius: 'var(--rounding)',
    }}>
        {children}
    </nav>
)

/**
 * Each item carries its label, but the label is collapsed to `max-width: 0`
 * unless an ancestor matches `.DesktopSideBar[data-expanded='true']` — that
 * shell is the app's own DesktopSideBar server component and is not part of this
 * design system, so these cards show the icon-only rail. The `expanded` prop
 * itself controls only whether the item is wrapped in a NavTooltip (expanded =
 * no tooltip), which a static card cannot show either.
 */
export const IconRail = () => (
    <Rail>
        {items.map(item => <SideBarNavItem key={item.href} item={item} expanded={false} />)}
    </Rail>
)

export const SingleItem = () => (
    <Rail>
        <SideBarNavItem item={items[0]} expanded={false} />
    </Rail>
)
