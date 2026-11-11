import '@pn-server-only'
import { receiversOfAliases } from '@/services/mail/received'
import { prisma } from '@/prisma-pn-client-instance'
import type { MailServerAccount, MailServerClient } from './client'
import type { SyncedMailbox } from './mailboxes'

/**
 * Who may open a mailbox is who receives the alias's mail, and the sync is what tells the server:
 * the token someone signs in to the webmail with only says who they are. Each account of someone
 * who has signed in, which is a user account on the webmail's domain named by their username, is
 * made a member of exactly the mailboxes of the aliases they receive, every run. So someone put on
 * an alias has its mailbox within the minute, and someone taken off loses it, also when they read
 * it with an app password in a mail client and never sign in again.
 *
 * Only memberships of our mailboxes are touched, the stale ones included, so that those can be
 * destroyed afterwards: the server refuses to destroy a group that has members.
 *
 * @returns how many accounts had their memberships changed, and what the server refused.
 */
export async function syncMemberships(
    client: MailServerClient,
    accounts: MailServerAccount[],
    accountDomainId: string,
    mailboxes: SyncedMailbox[],
    stale: string[],
): Promise<{ changed: number, refused: string[] }> {
    const receivers = await receiversOfAliases(prisma)
    const mailboxesOfUsername = new Map<string, string[]>()
    for (const { aliasId, accountId } of mailboxes) {
        for (const username of receivers.get(aliasId) ?? []) {
            const key = username.toLowerCase()
            mailboxesOfUsername.set(key, [...(mailboxesOfUsername.get(key) ?? []), accountId])
        }
    }
    const ours = new Set([...mailboxes.map(mailbox => mailbox.accountId), ...stale])

    const update: Record<string, { memberGroupIds: Record<string, true> }> = {}
    for (const account of accounts) {
        if (account['@type'] !== 'User' || account.domainId !== accountDomainId) continue
        const current = Object.keys(account.memberGroupIds ?? {})
        const wanted = new Set([
            ...current.filter(id => !ours.has(id)),
            ...(mailboxesOfUsername.get(account.name.toLowerCase()) ?? []),
        ])
        if (wanted.size === current.length && current.every(id => wanted.has(id))) continue
        const memberGroupIds: Record<string, true> = {}
        wanted.forEach(id => { memberGroupIds[id] = true })
        update[account.id] = { memberGroupIds }
    }
    const { updated, refused } = await client.set('Account', { update })
    return { changed: updated, refused }
}
