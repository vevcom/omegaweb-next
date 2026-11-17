import Menu from './Menu'
import UserNavigation from './UserNavigation'
import MobileNavBarItems from './MobileNavBarItems'
import MobileMagicHat from './MobileMagicHat'
import StandardImageServer from '@/components/Image/StandardImageServer'
import type { NavLink } from '@/lib/navDef/navDef'

type PropTypes = {
    isLoggedIn: boolean
    /** The nav items the session may open, as `visibleNavItems` leaves them. */
    navItems: NavLink[]
}

export default function MobileNavBar({ isLoggedIn, navItems }: PropTypes) {
    return (
        <nav className="
            relative hidden
            max-mobile:grid
            grid-cols-5 grid-rows-[auto] w-full h-full p-4 overflow-hidden bg-base-100 text-base-content
            [&>*]:grid [&>*]:place-items-center
            [&>*>button]:[background:none] [&>*>button]:text-inherit [&>*>button]:border-none [&>*>button]:p-0
            [&>*>button]:[font:inherit] [&>*>button]:cursor-pointer [&>*>button]:[outline:inherit]
        ">
            <MobileNavBarItems navItems={navItems} />
            <MobileMagicHat>
                <StandardImageServer
                    standardImage="MAGISK_HATT"
                    width={25}
                    height={25}
                    alt={isLoggedIn ? 'Profil' : 'Logg inn'}
                    tint="var(--color-base-content)"
                />
                <UserNavigation isLoggedIn={isLoggedIn} />
            </MobileMagicHat>
            <Menu
                items={navItems}
                openBtnVariant={'mobile'}
            />
        </nav>
    )
}
