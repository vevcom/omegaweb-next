import '@pn-server-only'
import { mailServerWebmail } from '@/services/mail/server/constants'
import { mailboxAddressOf } from '@/services/mail/server/mailboxes'
import { prisma } from '@/prisma-pn-client-instance'
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
 * The mailboxes a user may open: those of the aliases they receive mail on, by their addresses on
 * the mail server. The token a user signs in to the webmail with names them as the
 * groups the user is in, which the mail server makes them a member of, see mail/server/mailboxes.ts.
 * None without a webmail.
 */
export async function mailboxesReceivedBy(userId: number): Promise<string[]> {
    if (!mailServerWebmail) return []
    const { domain } = mailServerWebmail
    const aliases = await aliasesReceivedBy(prisma, userId)
    return aliases.map(alias => mailboxAddressOf(alias.address, domain))
}
