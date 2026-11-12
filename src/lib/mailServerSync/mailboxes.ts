import '@pn-server-only'
import { prisma } from '@/prisma-pn-client-instance'
import logger from '@/lib/logger'
import type { MailServerAccount, MailServerClient } from './client'

/**
 * The mailbox of an alias is a group account on the mail server: a mailbox with no login of its
 * own, which its members see as a shared folder in the webmail. It is the alias's own address, on
 * the alias's own domain, so members see the alias and answer as it. The sync keeps one per alias,
 * and the mailbox forwards the mail to the people behind the alias (see forwarding.ts). Who the
 * members are is kept by memberships.ts.
 */

export type MailboxChanges = {
    created: number,
    updated: number,
}

/** A mailbox as it is on the server once the sync has run. */
export type SyncedMailbox = {
    accountId: string,
    aliasId: number,
    aliasAddress: string,
}

export type SyncedMailboxes = {
    changes: MailboxChanges,
    mailboxes: SyncedMailbox[],
    /**
     * The groups no alias took, which are still on the server: the server refuses to destroy a
     * group that has members, so the caller unlinks them first (see memberships.ts) and then calls
     * {@link destroyMailboxes}.
     */
    stale: string[],
    /** What the server refused, see sync.ts. An alias whose mailbox was refused is not among `mailboxes`. */
    refused: string[],
}

type AliasMailbox = {
    id: number,
    address: string,
    mailboxAccountId: string | null,
}

type WantedGroup = {
    '@type': 'Group',
    name: string,
    domainId: string,
    description: string,
}

/** The address of the mailbox of an alias: the alias's own, as the server writes addresses. */
export function mailboxAddressOf(aliasAddress: string): string {
    return aliasAddress.toLowerCase()
}

/** The id a creation is sent under, see sync.ts. */
export function creationId(address: string, index: number): string {
    return `${address.replace(/[^A-Za-z0-9_-]/g, '_')}-${index}`
}

/**
 * Makes the group accounts on the sites' domains match the aliases: one per alias, at the alias's
 * address and moved with it, and none for an alias that is gone.
 *
 * Which group is an alias's goes by address first: the group at the alias's address is its,
 * whatever any alias remembers, which adopts a group a failed run created but did not store, and
 * makes stale ids harmless after the server was set up anew. An alias without one takes the group
 * it remembers, if no other alias took it, and moves it: that is a renamed alias, which keeps its
 * mail. A group on `formerMailboxDomainId` is one from when the mailboxes were on the webmail's
 * domain, and moves to its alias's address the same way. The rest are created, and groups no alias
 * took are stale, for the caller to destroy. Moves go to the server first, so a creation never meets
 * an address about to be freed. A stale group never holds an address a creation wants: an alias at
 * its address would have taken it. A group whose move was refused is still its alias's, by the id
 * the alias remembers, and the next run moves it.
 */
export async function syncMailboxes(
    client: MailServerClient,
    accounts: MailServerAccount[],
    siteDomainIdsByName: Map<string, string>,
    formerMailboxDomainId: string | undefined,
): Promise<SyncedMailboxes> {
    const aliases: AliasMailbox[] = await prisma.mailAlias.findMany({
        select: { id: true, address: true, mailboxAccountId: true },
    })
    const domainNamesById = new Map(Array.from(siteDomainIdsByName, ([name, id]) => [id, name]))

    const groups = new Map<string, MailServerAccount>()
    const groupsByAddress = new Map<string, MailServerAccount>()
    for (const account of accounts) {
        if (account['@type'] !== 'Group') continue
        const domain = domainNamesById.get(account.domainId)
        if (domain === undefined && account.domainId !== formerMailboxDomainId) continue
        groups.set(account.id, account)
        if (domain !== undefined) groupsByAddress.set(`${account.name}@${domain}`.toLowerCase(), account)
    }

    const unplaced: string[] = []
    const wanted = aliases.flatMap(alias => {
        const address = mailboxAddressOf(alias.address)
        const at = address.lastIndexOf('@')
        const domainId = siteDomainIdsByName.get(address.slice(at + 1))
        if (domainId === undefined) {
            unplaced.push(alias.address)
            return []
        }
        return [{ alias, address, name: address.slice(0, at), domainId }]
    })
    if (unplaced.length > 0) {
        logger.warn(`Mail server sync keeps no mailbox for aliases on domains the server does not hold for the sites: ${
            unplaced.join(', ')}`)
    }

    const groupOfAlias = new Map<number, MailServerAccount>()
    const taken = new Set<string>()
    for (const { alias, address } of wanted) {
        const group = groupsByAddress.get(address)
        if (group && !taken.has(group.id)) {
            groupOfAlias.set(alias.id, group)
            taken.add(group.id)
        }
    }
    for (const { alias } of wanted) {
        if (groupOfAlias.has(alias.id) || alias.mailboxAccountId === null) continue
        const group = groups.get(alias.mailboxAccountId)
        if (group && !taken.has(group.id)) {
            groupOfAlias.set(alias.id, group)
            taken.add(group.id)
        }
    }

    const create: Record<string, WantedGroup> = {}
    const aliasOfCreation = new Map<string, number>()
    const update: Record<string, Partial<WantedGroup>> = {}
    /** The group each alias is to remember from now on. */
    const remember = new Map<number, string>()
    /** The group of each alias that has one once the calls below are through. */
    const accountIdOfAlias = new Map<number, string>()

    wanted.forEach(({ alias, address, name, domainId }, index) => {
        const group = groupOfAlias.get(alias.id)
        if (!group) {
            const id = creationId(address, index)
            create[id] = { '@type': 'Group', name, domainId, description: alias.address }
            aliasOfCreation.set(id, alias.id)
            return
        }
        accountIdOfAlias.set(alias.id, group.id)
        if (group.id !== alias.mailboxAccountId) remember.set(alias.id, group.id)
        const changes: Partial<WantedGroup> = {}
        if (group.name !== name) changes.name = name
        if (group.domainId !== domainId) changes.domainId = domainId
        if ((group.description ?? '') !== alias.address) changes.description = alias.address
        if (Object.keys(changes).length > 0) update[group.id] = changes
    })
    const stale = Array.from(groups.keys()).filter(id => !taken.has(id))

    const moved = await client.set('Account', { update })
    const made = await client.set('Account', { create })
    for (const [id, created] of Object.entries(made.created)) {
        const aliasId = aliasOfCreation.get(id)
        if (aliasId === undefined) continue
        remember.set(aliasId, created.id)
        accountIdOfAlias.set(aliasId, created.id)
    }
    // Every alias that is to remember something else forgets first, since an id is remembered by one alias alone.
    if (remember.size > 0) {
        await prisma.mailAlias.updateMany({
            where: { id: { in: Array.from(remember.keys()) } },
            data: { mailboxAccountId: null },
        })
    }
    for (const [aliasId, accountId] of Array.from(remember)) {
        await prisma.mailAlias.updateMany({ where: { id: aliasId }, data: { mailboxAccountId: accountId } })
    }

    return {
        changes: {
            created: Object.keys(made.created).length,
            updated: moved.updated,
        },
        mailboxes: wanted.flatMap(({ alias }) => {
            const accountId = accountIdOfAlias.get(alias.id)
            return accountId === undefined ? [] : [{ accountId, aliasId: alias.id, aliasAddress: alias.address }]
        }),
        stale,
        refused: [...moved.refused, ...made.refused],
    }
}

/**
 * Destroys the groups a run of {@link syncMailboxes} found stale, once nobody is a member of them.
 *
 * @returns how many were destroyed, and what the server refused.
 */
export async function destroyMailboxes(
    client: MailServerClient,
    stale: string[],
): Promise<{ destroyed: number, refused: string[] }> {
    const { destroyed, refused } = await client.set('Account', { destroy: stale })
    return { destroyed, refused }
}
