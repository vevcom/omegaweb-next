import SiteLink from '@/components/SiteLink/SiteLink'
import { appHref } from '@/lib/sites/href'
import { omegaAuthLinks } from '@/app/(omegaweb)/(auth)/links'

type PropTypes = {
    isLoggedIn: boolean
}

/**
 * Renders an invisible link over the avatar button: to the user's own
 * profile page when logged in, or to /login when logged out. The profile
 * page already exposes settings, Omega-ID, account and logout, so there's
 * no need to duplicate those behind a popup here.
 */
export default function UserNavigation({ isLoggedIn }: PropTypes) {
    const href = isLoggedIn ? appHref('/users/me') : omegaAuthLinks.login()

    return <SiteLink className="
        opacity-0 w-full h-full absolute top-0 left-0
        hover:cursor-pointer
    " href={href} />
}
