import '@pn-server-only'
import { userBasicSelection, userPartitions } from '@/services/users/constants'
import { groupsWithRelationsIncluder } from '@/services/groups/constants'
import { assertGroupValidity } from '@/services/groups/assertGroupValidity'
import { inferGroupName } from '@/lib/groups/inferGroupName'
import { administrates, markOwned, ownerVisibilityIncluder } from '@/services/mail/owned'
import type { Prisma } from '@/prisma-generated-pn-client'
import type { GroupWithDumbRelations, MembershipFiltered } from '@/services/groups/types'
import type { MailFlowGroup, MailFlowObject, MailFlowPaths, ViaType } from '@/services/mail/types'


/**
 * This file reads how incoming mail is routed.
 * Mail flows in one direction
 * Mailalias -> Mailinglist -> User
 *                          -> Group -> User
 *                          -> External address
 *
 * To show how the mail traverses, each node in the network above can be used
 * as a source to read the traversal in both directions.
 * Each of the traversal functions is divided in four parts
 *  1. Fetch the data from the database
 *  2. Parse the data into arrays with only one type of object
 *       This step also marks how each node was reached (next paragraph)
 *  3. Delete unnecessary fields
 *  4. Combine duplicate nodes
 *
 *
 * Since some nodes may have different paths to itself, every node says how it was reached:
 * directly, or via which other nodes. For example a user can be directly connected to a
 * mailinglist and be on it via a group too. We only want the user to appear once, but we want
 * to return all the paths to the user (both direct and via the group).
 *
 * Aliases and lists also say whether the memberships given own them, and groups whether they
 * administrate them, so the flow can mark what the viewer has authority over.
 *
 * The end results should be an object that can be displayed to the user to show
 * how mail is routed though an arbitrary node in the network.
*/

const includeUser = {
    user: {
        select: userBasicSelection,
    },
} as const

const includeAliases = {
    mailAliases: {
        include: {
            mailAlias: { include: ownerVisibilityIncluder },
        },
    },
} as const satisfies Prisma.MailingListInclude

const includeMailingListsWithAliases = {
    mailingLists: {
        include: {
            mailingList: {
                include: { ...includeAliases, ...ownerVisibilityIncluder },
            },
        },
    },
} as const

/** The active, unarchived members: the ones mail to the group actually reaches. */
const includeMembers = {
    memberships: {
        where: { active: true, user: userPartitions.unarchived },
        include: includeUser,
    },
} as const satisfies Prisma.GroupInclude

/**
 * Everything a mailing list forwards to: its groups with their members, its users and its external addresses.
 */
const includeRecipients = {
    groups: {
        include: {
            group: {
                include: {
                    ...groupsWithRelationsIncluder,
                    ...includeMembers,
                },
            },
        },
    },
    users: {
        where: { user: userPartitions.unarchived },
        include: includeUser,
    },
    mailAddressExternal: {
        include: {
            mailAddressExternal: true,
        },
    },
} as const satisfies Prisma.MailingListInclude

function mailingListsOf<MailingList>(node: { mailingLists: { mailingList: MailingList }[] }): MailingList[] {
    return node.mailingLists.map(list => list.mailingList)
}

function aliasesOf<Alias>(mailingList: { mailAliases: { mailAlias: Alias }[] }): Alias[] {
    return mailingList.mailAliases.map(aliasItem => aliasItem.mailAlias)
}

function membersOf<User>(group: { memberships: { user: User }[] }): User[] {
    return group.memberships.map(membership => membership.user)
}

function direct<Node extends object>(node: Node): Node & MailFlowPaths {
    return { ...node, direct: true, via: [] }
}

function reachedVia<Node extends object>(node: Node, via: ViaType): Node & MailFlowPaths {
    return { ...node, direct: false, via: [via] }
}

type GroupWithNameRelations = GroupWithDumbRelations<'name', 'name', 'level', 'name', 'omegaMembershipLevel', 'name'>
const groupTypeRelations = [
    'committee', 'manualGroup', 'class', 'interestGroup', 'omegaMembershipGroup', 'studyProgramme',
] as const

/**
 * A group as the flow shows it: named after its type-specific relation, which is then dropped,
 * and marked when the memberships administrate it.
 */
function toFlowGroup<Group extends GroupWithNameRelations>(
    group: Group,
    memberships: MembershipFiltered[],
): MailFlowGroup & Omit<Group, typeof groupTypeRelations[number]> {
    const name = inferGroupName(assertGroupValidity(group))
    // On a copy, since the same group is named once per path that reaches it.
    return { ...withoutRelations({ ...group }, ...groupTypeRelations), name, admin: administrates(group.id, memberships) }
}

/**
 * The nodes each mailing list leads to, every one marked as reached through that list.
 */
function throughMailingLists<MailingList extends { id: number, name: string }, Node extends object>(
    mailingLists: MailingList[],
    nodesOf: (mailingList: MailingList) => Node[],
) {
    return mailingLists.flatMap(mailingList => nodesOf(mailingList).map(node => reachedVia(node, {
        type: 'mailingList',
        id: mailingList.id,
        label: mailingList.name,
    })))
}

/**
 * The nodes each group leads to, every one marked as reached through that group.
 */
function throughGroups<Group extends { id: number, name: string }, Node extends object>(
    groups: Group[],
    nodesOf: (group: Group) => Node[],
) {
    return groups.flatMap(group => nodesOf(group).map(node => reachedVia(node, {
        type: 'group',
        id: group.id,
        label: group.name,
    })))
}

/**
 * Deletes, in place, the relations that were only included to walk the graph.
 */
function withoutRelations<Node extends object, Relation extends keyof Node>(
    node: Node,
    ...relations: Relation[]
): Omit<Node, Relation> {
    relations.forEach(relation => Reflect.deleteProperty(node, relation))
    return node
}

/**
 * Keeps each node once, by `id`, with every path to it: the first one encountered is kept, and the
 * paths of later ones with the same `id` are merged into it.
 */
function mergePaths<Node extends { id: number } & MailFlowPaths>(nodes: Node[]): Node[] {
    const unique: Node[] = []

    nodes.forEach(node => {
        const existing = unique.find(item => item.id === node.id)
        if (!existing) {
            unique.push(node)
            return
        }
        existing.direct = existing.direct || node.direct
        node.via.forEach(via => {
            const alreadyAdded = existing.via.some(item => item.type === via.type && item.id === via.id)
            if (!alreadyAdded) existing.via.push(via)
        })
    })

    return unique
}

export async function readAliasTraversal(
    prisma: Prisma.TransactionClient,
    id: number,
    memberships: MembershipFiltered[],
): Promise<MailFlowObject> {
    const alias = await prisma.mailAlias.findUniqueOrThrow({
        where: { id },
        include: {
            ...ownerVisibilityIncluder,
            mailingLists: {
                include: {
                    mailingList: {
                        include: { ...includeRecipients, ...ownerVisibilityIncluder },
                    },
                },
            },
        },
    })

    const mailingList = mailingListsOf(alias)
    const groupsOf = (list: typeof mailingList[number]) => list.groups.map(
        groupItem => toFlowGroup(groupItem.group, memberships),
    )
    const group = throughMailingLists(mailingList, groupsOf)
    const user = [
        ...throughMailingLists(mailingList, list => list.users.map(userItem => userItem.user)),
        ...mailingList.flatMap(list => throughGroups(groupsOf(list), membersOf)),
    ]
    const mailaddressExternal = throughMailingLists(
        mailingList,
        list => list.mailAddressExternal.map(address => address.mailAddressExternal),
    )

    return {
        alias: [direct(markOwned(withoutRelations(alias, 'mailingLists'), memberships))],
        mailingList: mailingList.map(list => direct(markOwned(
            withoutRelations(list, 'users', 'groups', 'mailAddressExternal'),
            memberships,
        ))),
        group: mergePaths(group.map(groupItem => withoutRelations(groupItem, 'memberships'))),
        user: mergePaths(user),
        mailaddressExternal: mergePaths(mailaddressExternal),
    }
}

export async function readMailingListTraversal(
    prisma: Prisma.TransactionClient,
    id: number,
    memberships: MembershipFiltered[],
): Promise<MailFlowObject> {
    const mailingList = await prisma.mailingList.findUniqueOrThrow({
        where: { id },
        include: {
            ...includeAliases,
            ...includeRecipients,
            ...ownerVisibilityIncluder,
        },
    })

    const alias = aliasesOf(mailingList)
    const group = mailingList.groups.map(groupItem => toFlowGroup(groupItem.group, memberships))
    const user = [
        ...mailingList.users.map(userItem => direct(userItem.user)),
        ...throughGroups(group, membersOf),
    ]
    const mailaddressExternal = mailingList.mailAddressExternal.map(address => address.mailAddressExternal)

    return {
        mailingList: [direct(markOwned(
            withoutRelations(mailingList, 'mailAliases', 'groups', 'users', 'mailAddressExternal'),
            memberships,
        ))],
        alias: alias.map(aliasItem => direct(markOwned(aliasItem, memberships))),
        group: group.map(groupItem => direct(withoutRelations(groupItem, 'memberships'))),
        user: mergePaths(user),
        mailaddressExternal: mailaddressExternal.map(direct),
    }
}

export async function readMailaddressExternalTraversal(
    prisma: Prisma.TransactionClient,
    id: number,
    memberships: MembershipFiltered[],
): Promise<MailFlowObject> {
    const mailaddressExternal = await prisma.mailAddressExternal.findUniqueOrThrow({
        where: { id },
        include: includeMailingListsWithAliases,
    })

    const mailingList = mailingListsOf(mailaddressExternal)
    const alias = throughMailingLists(mailingList, aliasesOf)

    return {
        mailaddressExternal: [direct(withoutRelations(mailaddressExternal, 'mailingLists'))],
        mailingList: mailingList.map(list => direct(markOwned(withoutRelations(list, 'mailAliases'), memberships))),
        alias: mergePaths(alias).map(aliasItem => markOwned(aliasItem, memberships)),
        user: [],
        group: [],
    }
}

export async function readGroupTraversal(
    prisma: Prisma.TransactionClient,
    id: number,
    memberships: MembershipFiltered[],
): Promise<MailFlowObject> {
    const group = await prisma.group.findUniqueOrThrow({
        where: { id },
        include: {
            ...groupsWithRelationsIncluder,
            ...includeMembers,
            ...includeMailingListsWithAliases,
        },
    })

    const mailingList = mailingListsOf(group)
    const alias = throughMailingLists(mailingList, aliasesOf)
    const user = membersOf(group)

    return {
        mailaddressExternal: [],
        mailingList: mailingList.map(list => direct(markOwned(withoutRelations(list, 'mailAliases'), memberships))),
        alias: mergePaths(alias).map(aliasItem => markOwned(aliasItem, memberships)),
        user: user.map(direct),
        group: [direct(withoutRelations(toFlowGroup(group, memberships), 'memberships', 'mailingLists'))],
    }
}

export async function readUserTraversal(
    prisma: Prisma.TransactionClient,
    id: number,
    memberships: MembershipFiltered[],
): Promise<MailFlowObject> {
    const user = await prisma.user.findUniqueOrThrow({
        where: { id },
        select: {
            ...userBasicSelection,
            ...includeMailingListsWithAliases,
            memberships: {
                where: { active: true },
                include: {
                    group: {
                        include: {
                            ...groupsWithRelationsIncluder,
                            ...includeMailingListsWithAliases,
                        },
                    },
                },
            },
        },
    })

    const groups = user.memberships.map(membership => toFlowGroup(membership.group, memberships))
    const directMailingLists = mailingListsOf(user)
    const mailingList = [
        ...directMailingLists.map(direct),
        ...throughGroups(groups, mailingListsOf),
    ]
    const alias = [
        ...throughMailingLists(directMailingLists, aliasesOf),
        ...groups.flatMap(group => throughMailingLists(mailingListsOf(group), aliasesOf)),
    ]

    return {
        mailaddressExternal: [],
        mailingList: mergePaths(mailingList.map(list => withoutRelations(list, 'mailAliases')))
            .map(list => markOwned(list, memberships)),
        alias: mergePaths(alias).map(aliasItem => markOwned(aliasItem, memberships)),
        user: [direct(withoutRelations(user, 'mailingLists', 'memberships'))],
        group: groups.map(group => direct(withoutRelations(group, 'mailingLists'))),
    }
}
