import '@pn-server-only'
import { userPartitions } from '@/services/users/constants'
import type { Prisma } from '@/prisma-generated-pn-client'
import type { MailAlias } from '@/prisma-generated-pn-types'

/**
 * The aliases a user receives mail on: those with a mailing list the user is on, or that reaches a
 * group the user is an active member of. The same way incoming mail is routed, see recipients.ts.
 */
export async function aliasesReceivedBy(client: Prisma.TransactionClient, userId: number): Promise<MailAlias[]> {
    return client.mailAlias.findMany({
        where: {
            mailingLists: { some: { mailingList: { OR: [
                { users: { some: { userId } } },
                { groups: { some: { group: { memberships: { some: { userId, active: true } } } } } },
            ] } } },
        },
        orderBy: { address: 'asc' },
    })
}

/**
 * The usernames of those who receive mail on each alias, by the alias's id: the rule of
 * {@link aliasesReceivedBy} read the other way round, for every alias at once. An archived user
 * receives nothing.
 */
export async function receiversOfAliases(client: Prisma.TransactionClient): Promise<Map<number, string[]>> {
    const receiver = { where: { user: userPartitions.unarchived }, select: { user: { select: { username: true } } } }
    const aliases = await client.mailAlias.findMany({
        select: {
            id: true,
            mailingLists: { select: { mailingList: { select: {
                users: receiver,
                groups: { select: { group: { select: {
                    memberships: { ...receiver, where: { ...receiver.where, active: true } },
                } } } },
            } } } },
        },
    })
    return new Map(aliases.map(alias => [alias.id, Array.from(new Set(alias.mailingLists.flatMap(({ mailingList }) => [
        ...mailingList.users.map(relation => relation.user.username),
        ...mailingList.groups.flatMap(relation => relation.group.memberships.map(membership => membership.user.username)),
    ])))]))
}
