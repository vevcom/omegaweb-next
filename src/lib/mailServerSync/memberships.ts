import '@pn-server-only'
import { receiversOfAliases } from '@/services/mail/received'
import { prisma } from '@/prisma-pn-client-instance'
import type { MailServerClient } from './client'
import type { SyncedMailbox } from './mailboxes'
import type { UserMailbox } from './userMailboxes'

/**
 * Who may open the mailbox of an alias is who receives the alias's mail, and the sync is what
 * tells the server: the token someone signs in to the webmail with only says who they are. The
 * account of each user, see userMailboxes.ts, is made a member of exactly the mailboxes of the
 * aliases they receive, every run. So someone put on an alias has its mailbox within the minute,
 * and someone taken off loses it, also when they read it with an app password in a mail client
 * and never sign in again.
 *
 * Only memberships of our mailboxes are touched, the stale ones included, so that those can be
 * destroyed afterwards: the server refuses to destroy a group that has members.
 *
 * @returns how many accounts had their memberships changed, and what the server refused.
 */
export async function syncMemberships(
    client: MailServerClient,
    userMailboxes: UserMailbox[],
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
    for (const { accountId, username, memberGroupIds: current } of userMailboxes) {
        const wanted = new Set([
            ...current.filter(id => !ours.has(id)),
            ...(mailboxesOfUsername.get(username) ?? []),
        ])
        if (wanted.size === current.length && current.every(id => wanted.has(id))) continue
        const memberGroupIds: Record<string, true> = {}
        wanted.forEach(id => { memberGroupIds[id] = true })
        update[accountId] = { memberGroupIds }
    }
    const { updated, refused } = await client.set('Account', { update })
    return { changed: updated, refused }
}
