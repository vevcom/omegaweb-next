import { adminNavDef } from '@/app/(omegaweb)/admin/adminNavDef'
import type { ServerPageSession } from '@/app/ServerPage'

/**
 * Guards an admin page with the authorizers of its `adminNavDef` item. It is meant to be called from
 * the page's serverPage operation, which sends an anonymous user to login and shows a logged-in one
 * the error view.
 *
 * @param path - The page's key in `adminNavDef`. `null` is the admin front page, which anyone with
 * any admin page to open may see.
 */
export function authorizeAdminPage(
    path: Parameters<typeof adminNavDef.authorize>[0] | null,
    session: ServerPageSession,
) {
    if (path === null) {
        adminNavDef.authorizeAny(session)
    } else {
        adminNavDef.authorize(path, session)
    }
}
