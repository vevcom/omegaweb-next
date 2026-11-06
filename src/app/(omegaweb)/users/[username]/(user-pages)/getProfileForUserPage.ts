import { userOperations } from '@/services/users/operations'
import { userNavDef } from '@/app/(omegaweb)/users/[username]/userNavDef'
import { siteRedirect } from '@/app/domainContextOfRequest'
import { appHref } from '@/lib/sites/href'
import { notFound } from 'next/navigation'
import type { ServerPageSession } from '@/app/ServerPage'
import type { UserNavPath } from '@/app/(omegaweb)/users/[username]/userNavDef'

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
export async function getProfileForUserPage({ username }: Params, path: UserNavPath, session: ServerPageSession) {
    if (username === 'me') {
        if (!session.user) return notFound()
        await siteRedirect(appHref(`/users/${session.user.username}/${path}`))
    }

    const profile = await userOperations.readProfile({ params: { username } })

    userNavDef({ username, userId: profile.user.id }).all.authorize(path, session)

    return { profile }
}
