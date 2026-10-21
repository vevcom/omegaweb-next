import Menu from './Menu'
import UserNavigation from './UserNavigation'
import MobileNavBarItems from './MobileNavBarItems'
import MobileMagicHat from './MobileMagicHat'
import StandardImageServer from '@/components/Image/StandardImageServer'
import EditModeSwitch from '@/components/EditModeSwitch/EditModeSwitch'
import type { NavLink } from './navDef'

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
            grid-cols-5 grid-rows-[auto] w-full h-full p-4 overflow-hidden bg-surface-base text-text
            [&>*:not(:last-child)]:grid [&>*:not(:last-child)]:place-items-center
            [&>*:not(:last-child)>button]:[background:none] [&>*:not(:last-child)>button]:text-inherit
            [&>*:not(:last-child)>button]:border-none [&>*:not(:last-child)>button]:p-0
            [&>*:not(:last-child)>button]:[font:inherit] [&>*:not(:last-child)>button]:cursor-pointer
            [&>*:not(:last-child)>button]:[outline:inherit]
        ">
            <MobileNavBarItems navItems={navItems} />
            <MobileMagicHat>
                <StandardImageServer
                    standardImage="MAGISK_HATT"
                    width={25}
                    height={25}
                    alt="log in button"
                    tint="var(--magic-hat-tint, var(--text))"
                />
                <UserNavigation isLoggedIn={isLoggedIn} />
            </MobileMagicHat>
            <Menu
                items={navItems}
                openBtnVariant={'mobile'}
            />
            <div className="
                absolute right-0 bottom-[calc(100%+3*var(--gap))] size-[48px] bg-black rounded-ss-[50%] translate-y-1/2
                [&_svg]:w-[30px]! [&_svg]:h-[30px]!
            ">
                <EditModeSwitch />
            </div>
        </nav>
    )
}
