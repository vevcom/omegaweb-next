import '@pn-server-only'
import { mailboxAddressOf } from './mailboxes'
import { signInNameOf } from './userMailboxes'
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

/**
 * Takes accounts out of the mailboxes of the aliases their users no longer receive, and puts no
 * one in any. For a run that cannot place the aliases, see sync.ts: someone taken off an alias
 * must lose its mailbox all the same, while giving one waits for a run that can keep the aliases.
 *
 * Nothing is created or moved here, so a mailbox is its alias's as the server has it: the group at
 * the alias's address, or else the one the alias remembers. An account is its user's by its sign
 * in name, and only accounts with one are touched, as in every run.
 *
 * @returns how many accounts lost a membership, and what the server refused.
 */
export async function revokeMemberships(
    client: MailServerClient,
    siteDomainIdsByName: Map<string, string>,
    accountDomainId: string,
): Promise<{ changed: number, refused: string[] }> {
    const accounts = await client.listAll('Account')
    const domainNamesById = new Map(Array.from(siteDomainIdsByName, ([name, id]) => [id, name]))

    const ours = new Set<string>()
    const mailboxesByAddress = new Map<string, string>()
    for (const account of accounts) {
        if (account['@type'] !== 'Group') continue
        const domain = domainNamesById.get(account.domainId)
        if (domain === undefined && account.domainId !== accountDomainId) continue
        ours.add(account.id)
        if (domain !== undefined) mailboxesByAddress.set(`${account.name}@${domain}`.toLowerCase(), account.id)
    }

    const aliases = await prisma.mailAlias.findMany({ select: { id: true, address: true, mailboxAccountId: true } })
    const receivers = await receiversOfAliases(prisma)
    const mailboxesOfUsername = new Map<string, Set<string>>()
    for (const alias of aliases) {
        const mailbox = mailboxesByAddress.get(mailboxAddressOf(alias.address)) ?? alias.mailboxAccountId
        if (mailbox === null) continue
        for (const username of receivers.get(alias.id) ?? []) {
            const key = username.toLowerCase()
            mailboxesOfUsername.set(key, (mailboxesOfUsername.get(key) ?? new Set()).add(mailbox))
        }
    }

    const update: Record<string, { memberGroupIds: Record<string, true> }> = {}
    for (const account of accounts) {
        if (account['@type'] !== 'User') continue
        const username = signInNameOf(account, accountDomainId)
        if (username === null) continue
        const current = Object.keys(account.memberGroupIds ?? {})
        const received = mailboxesOfUsername.get(username)
        const kept = current.filter(id => !ours.has(id) || received?.has(id))
        if (kept.length === current.length) continue
        update[account.id] = { memberGroupIds: Object.fromEntries(kept.map(id => [id, true])) }
    }
    if (Object.keys(update).length === 0) return { changed: 0, refused: [] }
    const { updated, refused } = await client.set('Account', { update })
    return { changed: updated, refused }
}
