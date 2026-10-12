import { userOperations } from '@/services/users/operations'
import { userNavDef } from '@/app/users/[username]/userNavDef'
import { notFound, redirect } from 'next/navigation'
import type { ServerPageSession } from '@/app/serverPage'
import type { Authorizer } from '@/auth/authorizer/Authorizer'

type Params = {
    username: string
}

/**
 * Wrapper used on all of a user's pages to auth the route and get the profile it is about.
 * It is meant to be called from the page's serverPage operation, which passes the session along.
 *
 * The page is guarded with the authorizers its nav item declares, and on the same terms: passing
 * any one of them is enough to open it, because each stands for something the page lets you do.
 * Taking them from one place is what keeps the nav from offering a page that then turns you away -
 * and what stops a page being left open when its nav item is tightened.
 *
 * Being let in says nothing about which parts of the page to render. That is the page's own job:
 * it re-runs the authorizers it cares about against the returned session.
 *
 * @param params - The username of the user whose page it is. If 'me' is passed, the current user's
 * own page is redirected to.
 * @param path - The page's path, as `userNavDef` spells it.
 * @param session - The session of the request, as the serverPage operation receives it.
 * @returns The profile being seen.
*/
export async function getProfileForUserPage({ username }: Params, path: string, session: ServerPageSession) {
    if (username === 'me') {
        if (!session.user) return notFound()
        redirect(`/users/${session.user.username}/${path}`) //This throws.
    }

    const profile = await userOperations.readProfile({ params: { username } })

    const navItem = userNavDef.find(item => item.path === path)
    if (!navItem) {
        throw new Error(`The user page '${path}' has no entry in userNavDef to be authorized with.`)
    }

    const authorizers = navItem.authorizers({ username, userId: profile.user.id })
    const passes = (authorizer: Authorizer) => authorizer.auth(session).authorized

    if (!authorizers.some(passes)) {
        authorizers[0].auth(session).requireAuthorized()
    }

    return { profile }
}
