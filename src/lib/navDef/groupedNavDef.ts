import { defineNavDef } from './navDef'
import type { NavItem, NavLink } from './navDef'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'

/** An item of a group, which is shown with the icon of its group. */
export type GroupedNavItem<Key extends string = string> = Omit<NavItem, 'key' | 'icon'> & { key: Key }

export type NavGroupHeader = {
    icon: IconDefinition,
    title: string,
}

export type NavGroup<Key extends string = string> = {
    header: NavGroupHeader,
    items: GroupedNavItem<Key>[],
}

/** What of a group the nav components render, so the authorizers stay on the server. */
export type NavGroupLinks<Key extends string = string> = {
    header: NavGroupHeader,
    links: NavLink<Key>[],
}

/**
 * A nav from its groups, in the order they are shown. It works as `defineNavDef` does over the items
 * of all the groups, except that `visible` keeps them in their groups.
 */
export function defineGroupedNavDef<Key extends string>(groups: NavGroup<Key>[]) {
    const groupsWithIcons = groups.map(group => ({
        header: group.header,
        items: group.items.map(item => ({ ...item, icon: group.header.icon })),
    }))

    return {
        ...defineNavDef(groupsWithIcons.flatMap(group => group.items)),

        /** The groups with only the items the session may open, leaving out groups with none left. */
        visible(session: SessionMaybeUser): NavGroupLinks<Key>[] {
            return groupsWithIcons
                .map(group => ({ header: group.header, links: defineNavDef(group.items).visible(session) }))
                .filter(group => group.links.length > 0)
        },
    }
}
