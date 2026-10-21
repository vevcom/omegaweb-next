import Item from './Item'
import UserNavigation from './UserNavigation'
import ReportButton from './ReportButton'
import SearchButton from './SearchButton'
import NavBarTitle from './NavBarTitle'
import HomeLogoLink from './HomeLogoLink'
import EditModeNavIcon from './EditModeNavIcon'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import StandardImageServer from '@/components/Image/StandardImageServer'
import ProfilePicture from '@/components/User/ProfilePicture'
import type { ExpandedImage } from '@/services/images/subservice/types'
import type { NavLink } from './navDef'

export type PropTypes = {
    isLoggedIn: boolean,
    profileImage: ExpandedImage | null,
    /** The nav items the session may open, as `visibleNavItems` leaves them. */
    navItems: NavLink[],
}

export default function NavBar({ isLoggedIn, profileImage, navItems }: PropTypes) {
    const navSize = 4
    const itemsForNav = navItems.slice(0, navSize - 1)

    return (
        <nav className="text-text text-m w-full h-[64px]">
            <ul className="w-full h-full flex flex-row justify-start items-center list-none">
                <li className="
                    flex items-center justify-center h-full relative bg-accent-blue rounded-[calc(2*var(--gap))] p-2
                ">
                    <HomeLogoLink className="flex items-center justify-center">
                        <div className="size-[48px] flex items-center justify-center">
                            <StandardImageServer
                                standardImage="LOGO_SIMPLE"
                                width={36}
                                alt="omega logo"
                                tint="white"
                            />
                        </div>
                    </HomeLogoLink>
                </li>

                <PageTitleSetter title="" />
                <li
                    className="
                        min-w-0 ml-2 flex items-center
                        max-mobile:[body:has([data-slide-sidebar-toggle])_&]:pr-[calc(44px+2*var(--gap))]
                    "
                    data-nav-title
                >
                    <NavBarTitle />
                </li>
                <li className="grow"></li>
                {
                    itemsForNav.map((item) => (
                        <li className="hidden" key={item.name}>
                            <Item key={item.name} {...item} />
                        </li>
                    ))
                }
                <li className="
                    flex w-auto ml-auto items-center gap-1
                    max-mobile:hidden
                ">
                    <EditModeNavIcon className="[--edit-mode-icon-size:30px] size-12" />
                    <SearchButton/>
                    <ReportButton/>
                    <div className="
                        btn relative m-0! size-[64px] p-0! flex items-center justify-center rounded-[calc(2*var(--gap))]!
                    ">
                        {
                            profileImage ? (
                                <ProfilePicture
                                    profileImage={profileImage}
                                    width={48}
                                />
                            ) : (
                                <StandardImageServer
                                    standardImage="MAGISK_HATT"
                                    width={39}
                                    alt="Logg inn"
                                    tint="white"
                                />
                            )
                        }
                        <UserNavigation isLoggedIn={isLoggedIn} />
                    </div>
                </li>
            </ul>
        </nav>
    )
}
