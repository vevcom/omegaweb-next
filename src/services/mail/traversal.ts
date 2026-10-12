import '@pn-server-only'
import { userBasicSelection } from '@/services/users/constants'
import type { Prisma } from '@/prisma-generated-pn-client'
import type { MailFlowObject, ViaArrayType, ViaType } from './types'


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
 *       This step also adds a via object (next paragraph) if it is necessary
 *  3. Delete unnecessary fields
 *  4. Combine duplicate nodes
 *
 *
 * Since some nodes may have different paths to itself, a via property is used.
 * For example a user can be directly connected to a mailinglist or via a group.
 * We only want the user to appear once, but we want to return
 * all the paths to the users (both via the group and direct).
 *
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
            mailAlias: true,
        },
    },
} as const satisfies Prisma.MailingListInclude

const includeMailingListsWithAliases = {
    mailingLists: {
        include: {
            mailingList: {
                include: includeAliases,
            },
        },
    },
} as const

/**
 * Everything a mailing list forwards to: its groups with their members, its users and its external addresses.
 */
const includeRecipients = {
    groups: {
        include: {
            group: {
                include: {
                    memberships: {
                        where: { active: true },
                        include: includeUser,
                    },
                },
            },
        },
    },
    users: {
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

function membersOf<User>(groupItem: { group: { memberships: { user: User }[] } }): User[] {
    return groupItem.group.memberships.map(membership => membership.user)
}

function withVia<Node extends object>(node: Node, via: ViaType): Node & { via: ViaType[] } {
    return { ...node, via: [via] }
}

/**
 * The nodes each mailing list leads to, every one marked as reached through that list.
 */
function throughMailingLists<MailingList extends { id: number, name: string }, Node extends object>(
    mailingLists: MailingList[],
    nodesOf: (mailingList: MailingList) => Node[],
) {
    return mailingLists.flatMap(mailingList => nodesOf(mailingList).map(node => withVia(node, {
        type: 'mailingList',
        id: mailingList.id,
        label: mailingList.name,
    })))
}

/**
 * The nodes each group leads to, every one marked as reached through that group.
 */
function throughGroups<GroupItem extends { groupId: number }, Node extends object>(
    groupItems: GroupItem[],
    nodesOf: (groupItem: GroupItem) => Node[],
) {
    return groupItems.flatMap(groupItem => nodesOf(groupItem).map(node => withVia(node, {
        type: 'group',
        id: groupItem.groupId,
        label: String(groupItem.groupId),
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
 * Removes duplicates from an array of objects based on their `id` property.
 * If multiple objects have the same `id`, the first object encountered is kept,
 * and the `via` property of subsequent objects with the same `id` is merged into the first object's `via` array.
 * @param objects An array of objects to remove duplicates from.
 * @returns An array of objects with duplicates removed.
 */
function removeDuplicates<T extends {
    id: number,
} & ViaArrayType>(objects: T[]): T[] {
    const unique: T[] = []

    objects.forEach(object => {
        const existingObject = unique.find(item => item.id === object.id)
        if (!existingObject) {
            unique.push(object)
            return
        }
        if (!existingObject.via || !object.via) return

        const via = object.via[0]
        const alreadyAdded = existingObject.via.find(item => (item.type === via.type && item.id === via.id))
        if (!alreadyAdded) {
            existingObject.via.push(via)
        }
    })

    return unique
}

export async function readAliasTraversal(prisma: Prisma.TransactionClient, id: number): Promise<MailFlowObject> {
    const alias = await prisma.mailAlias.findUniqueOrThrow({
        where: { id },
        include: {
            mailingLists: {
                include: {
                    mailingList: {
                        include: includeRecipients,
                    },
                },
            },
        },
    })

    const mailingList = mailingListsOf(alias)
    const group = throughMailingLists(mailingList, list => list.groups.map(groupItem => groupItem.group))
    const user = [
        ...throughMailingLists(mailingList, list => list.users.map(userItem => userItem.user)),
        ...mailingList.flatMap(list => throughGroups(list.groups, membersOf)),
    ]
    const mailaddressExternal = throughMailingLists(
        mailingList,
        list => list.mailAddressExternal.map(address => address.mailAddressExternal),
    )

    return {
        alias: [withoutRelations(alias, 'mailingLists')],
        mailingList: mailingList.map(list => withoutRelations(list, 'users', 'groups', 'mailAddressExternal')),
        group: removeDuplicates(group.map(groupItem => withoutRelations(groupItem, 'memberships'))),
        user: removeDuplicates(user),
        mailaddressExternal: removeDuplicates(mailaddressExternal),
    }
}

export async function readMailingListTraversal(prisma: Prisma.TransactionClient, id: number): Promise<MailFlowObject> {
    const mailingList = await prisma.mailingList.findUniqueOrThrow({
        where: { id },
        include: {
            ...includeAliases,
            ...includeRecipients,
        },
    })

    const alias = aliasesOf(mailingList)
    const group = mailingList.groups.map(groupItem => groupItem.group)
    const user = [
        ...mailingList.users.map(userItem => userItem.user),
        ...throughGroups(mailingList.groups, membersOf),
    ]
    const mailaddressExternal = mailingList.mailAddressExternal.map(address => address.mailAddressExternal)

    return {
        mailingList: [withoutRelations(mailingList, 'mailAliases', 'groups', 'users', 'mailAddressExternal')],
        alias,
        group: group.map(groupItem => withoutRelations(groupItem, 'memberships')),
        user: removeDuplicates(user),
        mailaddressExternal,
    }
}

export async function readMailaddressExternalTraversal(
    prisma: Prisma.TransactionClient,
    id: number,
): Promise<MailFlowObject> {
    const mailaddressExternal = await prisma.mailAddressExternal.findUniqueOrThrow({
        where: { id },
        include: includeMailingListsWithAliases,
    })

    const mailingList = mailingListsOf(mailaddressExternal)
    const alias = throughMailingLists(mailingList, aliasesOf)

    return {
        mailaddressExternal: [withoutRelations(mailaddressExternal, 'mailingLists')],
        mailingList: mailingList.map(list => withoutRelations(list, 'mailAliases')),
        alias: removeDuplicates(alias),
        user: [],
        group: [],
    }
}

export async function readGroupTraversal(prisma: Prisma.TransactionClient, id: number): Promise<MailFlowObject> {
    const group = await prisma.group.findUniqueOrThrow({
        where: { id },
        include: {
            memberships: {
                where: { active: true },
                include: includeUser,
            },
            ...includeMailingListsWithAliases,
        },
    })

    const mailingList = mailingListsOf(group)
    const alias = throughMailingLists(mailingList, aliasesOf)
    const user = group.memberships.map(membership => membership.user)

    return {
        mailaddressExternal: [],
        mailingList: mailingList.map(list => withoutRelations(list, 'mailAliases')),
        alias: removeDuplicates(alias),
        user,
        group: [withoutRelations(group, 'memberships', 'mailingLists')],
    }
}

export async function readUserTraversal(prisma: Prisma.TransactionClient, id: number): Promise<MailFlowObject> {
    const user = await prisma.user.findUniqueOrThrow({
        where: { id },
        select: {
            ...userBasicSelection,
            ...includeMailingListsWithAliases,
            memberships: {
                where: { active: true },
                include: {
                    group: {
                        include: includeMailingListsWithAliases,
                    },
                },
            },
        },
    })

    const directMailingLists = mailingListsOf(user)
    const mailingList = [
        ...directMailingLists,
        ...throughGroups(user.memberships, membership => mailingListsOf(membership.group)),
    ]
    const alias = [
        ...throughMailingLists(directMailingLists, aliasesOf),
        ...user.memberships.flatMap(membership => throughMailingLists(mailingListsOf(membership.group), aliasesOf)),
    ]
    const group = user.memberships.map(membership => membership.group)

    return {
        mailaddressExternal: [],
        mailingList: removeDuplicates(mailingList.map(list => withoutRelations(list, 'mailAliases'))),
        alias: removeDuplicates(alias),
        user: [withoutRelations(user, 'mailingLists', 'memberships')],
        group: group.map(groupItem => withoutRelations(groupItem, 'mailingLists')),
    }
}
