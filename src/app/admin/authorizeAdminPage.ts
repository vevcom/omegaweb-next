import { adminNavAuthorizers, adminNavDef } from '@/app/admin/adminNavDef'
import type { ServerPageSession } from '@/app/serverPage'

/**
 * Guards an admin page with the authorizers its `adminNavDef` link declares, on the same terms as
 * the nav: passing any one of them is enough to open it. Taking them from one place is what keeps
 * the nav from offering a page that then turns you away - and what stops a page being left open
 * when its link is tightened.
 *
 * Being let in says nothing about which parts of the page to render. That is the page's own job: it
 * re-runs the authorizers it cares about against the session.
 *
 * @param path - The page's path, as `adminNavDef` spells it. `null` is the admin front page, which
 * anyone with any admin page to open may see.
 * @param session - The session of the request, as the serverPage operation receives it.
 * @throws A service error when the session passes none of the authorizers. It is meant to be called
 * from the page's serverPage operation, which sends an anonymous user to login and shows a logged-in
 * one the error view.
 */
export function authorizeAdminPage(path: string | null, session: ServerPageSession) {
    const authorizers = path === null ? adminNavAuthorizers() : adminNavDef
        .flatMap(group => group.links)
        .find(link => link.path === path)
        ?.authorizers()
    if (!authorizers) {
        throw new Error(`The admin page '${path}' has no entry in adminNavDef to be authorized with.`)
    }

    if (!authorizers.some(authorizer => authorizer.auth(session).authorized)) {
        // Any one of them would have done, so the first is as good as another to be turned away by.
        authorizers[0].auth(session).requireAuthorized()
    }
}
