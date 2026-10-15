import Link from 'next/link'

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
    const href = isLoggedIn ? '/users/me' : '/login'

    return <Link className="opacity-0 w-full h-full absolute top-0 left-0 hover:cursor-pointer" href={href} />
}
