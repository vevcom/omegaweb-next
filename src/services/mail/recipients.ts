import '@pn-server-only'
import { userPartitions } from '@/services/users/constants'
import type { Prisma } from '@/prisma-generated-pn-client'
import type { UserBasic } from '@/services/users/types'

/** An address to send to, with the user it belongs to when there is one. */
export type MailRecipient = {
    address: string,
    user: UserBasic | null,
}

const recipientUserSelection = {
    id: true,
    username: true,
    firstname: true,
    lastname: true,
    email: true,
} as const satisfies Prisma.UserSelect

/**
 * Resolves typed addresses and mailing lists to the distinct addresses they reach. A mailing list
 * reaches its users, the active members of its groups and its external addresses, the same way
 * incoming mail is routed (see traversal.ts). An address that belongs to a user keeps that user.
 */
export async function resolveMailRecipients(
    prisma: Prisma.TransactionClient,
    { addresses, mailingListIds }: { addresses: string[], mailingListIds: number[] },
): Promise<MailRecipient[]> {
    const [mailingLists, typedUsers] = await Promise.all([
        prisma.mailingList.findMany({
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
        }),
        prisma.user.findMany({
            where: { email: { in: addresses, mode: 'insensitive' } },
            select: recipientUserSelection,
        }),
    ])

    const users = [
        ...typedUsers,
        ...mailingLists.flatMap(list => [
            ...list.users.map(relation => relation.user),
            ...list.groups.flatMap(relation => relation.group.memberships.map(membership => membership.user)),
        ]),
    ]
    const plainAddresses = [
        ...addresses,
        ...mailingLists.flatMap(list => list.mailAddressExternal.map(relation => relation.mailAddressExternal.address)),
    ]

    // Users go in first, so an address typed by hand or listed as external still gets its user.
    const recipients = new Map<string, MailRecipient>()
    for (const { email, ...user } of users) {
        recipients.set(email.toLowerCase(), { address: email, user })
    }
    for (const address of plainAddresses) {
        if (!recipients.has(address.toLowerCase())) recipients.set(address.toLowerCase(), { address, user: null })
    }
    return Array.from(recipients.values())
}
