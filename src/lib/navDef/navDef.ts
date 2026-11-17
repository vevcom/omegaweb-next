import '@pn-server-only'
import { prisma } from '@/prisma-pn-client-instance'
import type { Authorizer, UserRequiredOutOpt } from '@/auth/authorizer/Authorizer'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { Awaitable } from '@/lib/awaitable'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { AppHref, ExternalHref } from '@/lib/sites/href'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'

export type NavAuthorizer = Authorizer<UserRequiredOutOpt, object | undefined>

/**
 * What an item builds its authorizers with: the database, for a rule that needs data from it, such
 * as the owner matrices of every mailing list. The same as an operation's authorizer gets, so an
 * item supplies a rule its data the way the operation of the page does.
 */
export type NavAuthorizerContext = {
    prisma: PrismaPossibleTransaction<false>,
}

export type NavItem = {
    /** What the code calls the item: `href` and `authorize` take it. */
    key: string,
    name: string,
    href: AppHref | ExternalHref,
    icon: IconDefinition,
    /**
     * The authorizers of the page the item points at, and passing **any** of them is enough to be
     * shown it, so a link is never offered to a page that would turn the viewer away. Filtering
     * authorizers are welcome: only whether they pass is looked at, not the filter they hand back.
     * A rule that needs data reads it through the context, as the page's operation would.
     */
    authorizers: (context: NavAuthorizerContext) => Awaitable<NavAuthorizer[]>,
    /**
     * Who the entry is worded for, not who may open it: some pages are offered under one name to
     * visitors and another to members. Left out, the entry is for everyone the authorizers let in.
     */
    audience?: 'loggedIn' | 'loggedOut',
}

/** What of an item the nav components render, so the authorizers stay on the server. */
export type NavLink<Item extends NavItem = NavItem> = {
    key: Item['key'],
    name: string,
    href: Item['href'],
    icon: IconDefinition,
}

/** A link of a nav whose items are all pages of the app. */
export type AppNavLink = NavLink<NavItem & { href: AppHref }>

/**
 * A nav from its items, in the order they are shown. It remembers each item's href type by its key,
 * so `href` of a page of the app is an AppHref even when another item of the nav is external.
 */
export function defineNavDef<const Item extends NavItem>(items: readonly Item[]) {
    type Key = Item['key']

    const context: NavAuthorizerContext = { prisma }

    async function authorizers({ except }: { except?: Key } = {}): Promise<NavAuthorizer[]> {
        const ofItems = await Promise.all(items
            .filter(item => item.key !== except)
            .map(async item => item.authorizers(context)))
        return ofItems.flat()
    }

    async function opens(item: Item, session: SessionMaybeUser): Promise<boolean> {
        const itemAuthorizers = await item.authorizers(context)
        return itemAuthorizers.some(authorizer => authorizer.auth(session).authorized)
    }

    function itemOf<ItemKey extends Key>(key: ItemKey): Extract<Item, { key: ItemKey }> {
        const item = items.find((candidate): candidate is Extract<Item, { key: ItemKey }> => candidate.key === key)
        if (!item) throw new Error(`The nav has no item '${key}'.`)
        return item
    }

    return {
        items,

        /** The items the session may open and is the audience of, in order. */
        async visible(session: SessionMaybeUser): Promise<NavLink<Item>[]> {
            // A company user is signed in too, so they are not worded to as a visitor.
            const loggedIn = session.user !== null || Boolean(session.companyUser)
            const ofAudience = items
                .filter(item => item.audience === undefined || (item.audience === 'loggedIn') === loggedIn)
            const opened = await Promise.all(ofAudience.map(item => opens(item, session)))
            return ofAudience
                .filter((item, index) => opened[index])
                .map(({ key, name, href, icon }) => ({ key, name, href, icon }))
        },

        /** Every authorizer in the nav. Passing any of them is what it takes to have an item to open at all. */
        authorizers,

        href<ItemKey extends Key>(key: ItemKey): Extract<Item, { key: ItemKey }>['href'] {
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
        async authorize(key: Key, session: SessionMaybeUser): Promise<void> {
            requireAny(await itemOf(key).authorizers(context), session)
        },

        /** Guards a page that anyone with any item of the nav to open may see. */
        async authorizeAny(session: SessionMaybeUser): Promise<void> {
            requireAny(await authorizers(), session)
        },
    }
}

function requireAny(authorizers: NavAuthorizer[], session: SessionMaybeUser) {
    if (!authorizers.some(authorizer => authorizer.auth(session).authorized)) {
        // Any one of them would have done, so the first is as good as another to be turned away by.
        authorizers[0].auth(session).requireAuthorized()
    }
}
