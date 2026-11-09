import { defineNavDef } from './navDef'
import type { NavItem, NavLink } from './navDef'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'

/** An item of a group, which is shown with the icon of its group. */
export type GroupedNavItem = Omit<NavItem, 'icon'>

export type NavGroupHeader = {
    icon: IconDefinition,
    title: string,
}

export type NavGroup = {
    header: NavGroupHeader,
    items: readonly GroupedNavItem[],
}

/** What of a group the nav components render, so the authorizers stay on the server. */
export type NavGroupLinks<Item extends NavItem = NavItem> = {
    header: NavGroupHeader,
    links: NavLink<Item>[],
}

type GroupedNavDef<Item extends NavItem> = Omit<ReturnType<typeof defineNavDef<Item>>, 'visible'> & {
    /** The groups with only the items the session may open, leaving out groups with none left. */
    visible(session: SessionMaybeUser): Promise<NavGroupLinks<Item>[]>,
}

/**
 * A nav from its groups, in the order they are shown. It works as `defineNavDef` does over the items
 * of all the groups, except that `visible` keeps them in their groups.
 */
export function defineGroupedNavDef<const Group extends NavGroup>(
    groups: readonly Group[],
): GroupedNavDef<Group['items'][number] & { icon: IconDefinition }>
export function defineGroupedNavDef(groups: readonly NavGroup[]): GroupedNavDef<NavItem> {
    const groupsWithIcons = groups.map(group => ({
        header: group.header,
        items: group.items.map(item => ({ ...item, icon: group.header.icon })),
    }))

    return {
        ...defineNavDef(groupsWithIcons.flatMap(group => group.items)),

        async visible(session) {
            const groupLinks = await Promise.all(groupsWithIcons.map(async group => ({
                header: group.header,
                links: await defineNavDef(group.items).visible(session),
            })))
            return groupLinks.filter(group => group.links.length > 0)
        },
    }
}
