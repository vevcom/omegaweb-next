import type { Authorizer, UserRequiredOutOpt } from '@/auth/authorizer/Authorizer'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { AppHref, ExternalHref } from '@/lib/sites/href'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'

export type NavAuthorizer = Authorizer<UserRequiredOutOpt, object | undefined>

export type NavItem<Key extends string = string> = {
    /** What the code calls the item: `href` and `authorize` take it. */
    key: Key,
    name: string,
    href: AppHref | ExternalHref,
    icon: IconDefinition,
    /**
     * The authorizers of the page the item points at, and passing **any** of them is enough to be
     * shown it, so a link is never offered to a page that would turn the viewer away. Filtering
     * authorizers are welcome: only whether they pass is looked at, not the filter they hand back.
     */
    authorizers: () => NavAuthorizer[],
    /**
     * Who the entry is worded for, not who may open it: some pages are offered under one name to
     * visitors and another to members. Left out, the entry is for everyone the authorizers let in.
     */
    audience?: 'loggedIn' | 'loggedOut',
}

/** What of an item the nav components render, so the authorizers stay on the server. */
export type NavLink<Key extends string = string> = Pick<NavItem<Key>, 'key' | 'name' | 'href' | 'icon'>

/**
 * A nav from its items, in the order they are shown.
 */
export function defineNavDef<Key extends string>(items: NavItem<Key>[]) {
    function authorizers({ except }: { except?: Key } = {}): NavAuthorizer[] {
        return items
            .filter(item => item.key !== except)
            .flatMap(item => item.authorizers())
    }

    function itemOf(key: Key): NavItem<Key> {
        const item = items.find(candidate => candidate.key === key)
        if (!item) throw new Error(`The nav has no item '${key}'.`)
        return item
    }

    return {
        /** The items the session may open and is the audience of, in order. */
        visible(session: SessionMaybeUser): NavLink<Key>[] {
            const loggedIn = session.user !== null
            return items
                .filter(item => item.audience === undefined || (item.audience === 'loggedIn') === loggedIn)
                .filter(item => item.authorizers().some(authorizer => authorizer.auth(session).authorized))
                .map(({ key, name, href, icon }) => ({ key, name, href, icon }))
        },

        /** Every authorizer in the nav. Passing any of them is what it takes to have an item to open at all. */
        authorizers,

        href(key: Key): AppHref | ExternalHref {
            return itemOf(key).href
        },

        /**
         * Guards the page of an item with the authorizers it declares, on the same terms as the nav:
         * passing any one of them is enough to open it. Taking them from one place is what keeps the
         * nav from offering a page that then turns you away, and what stops a page being left open
         * when its item is tightened.
         *
         * @throws A service error when the session passes none of them.
         */
        authorize(key: Key, session: SessionMaybeUser) {
            requireAny(itemOf(key).authorizers(), session)
        },

        /** Guards a page that anyone with any item of the nav to open may see. */
        authorizeAny(session: SessionMaybeUser) {
            requireAny(authorizers(), session)
        },
    }
}

function requireAny(authorizers: NavAuthorizer[], session: SessionMaybeUser) {
    if (!authorizers.some(authorizer => authorizer.auth(session).authorized)) {
        // Any one of them would have done, so the first is as good as another to be turned away by.
        authorizers[0].auth(session).requireAuthorized()
    }
}
