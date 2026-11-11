import '@pn-server-only'
import { userPartitions } from '@/services/users/constants'
import type { Prisma } from '@/prisma-generated-pn-client'

const recipientUserSelection = {
    email: true,
} as const satisfies Prisma.UserSelect

/**
 * The distinct addresses mailing lists reach: their users, the active members of their groups and
 * their external addresses, the same way incoming mail is routed (see traversal.ts). The users'
 * addresses come first, in the spelling the user has.
 */
export async function mailingListAddresses(
    prisma: Prisma.TransactionClient,
    mailingListIds: number[],
): Promise<string[]> {
    const mailingLists = await prisma.mailingList.findMany({
        where: { id: { in: mailingListIds } },
        select: {
            users: {
                where: { user: userPartitions.unarchived },
                select: { user: { select: recipientUserSelection } },
            },
            groups: {
                select: {
                    group: {
                        select: {
                            memberships: {
                                where: { active: true, user: userPartitions.unarchived },
                                select: { user: { select: recipientUserSelection } },
                            },
                        },
                    },
                },
            },
            mailAddressExternal: {
                select: { mailAddressExternal: { select: { address: true } } },
            },
        },
    })

    const addresses = [
        ...mailingLists.flatMap(list => [
            ...list.users.map(relation => relation.user.email),
            ...list.groups.flatMap(relation => relation.group.memberships.map(membership => membership.user.email)),
        ]),
        ...mailingLists.flatMap(list => list.mailAddressExternal.map(relation => relation.mailAddressExternal.address)),
    ]
    const distinct = new Map<string, string>()
    for (const address of addresses) {
        if (!distinct.has(address.toLowerCase())) distinct.set(address.toLowerCase(), address)
    }
    return Array.from(distinct.values())
}
