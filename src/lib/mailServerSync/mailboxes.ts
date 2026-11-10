import '@pn-server-only'
import { DomainContext } from '@/lib/sites/context'
import { loadDomainConfig } from '@/lib/sites/loadDomainConfig'
import { Site } from '@/lib/sites/site'
import { prisma } from '@/prisma-pn-client-instance'
import type { MailServerAccount, MailServerClient } from './client'
import type { MailServerWebmail } from './constants'

/**
 * The mailbox of an alias is a group account on the mail server: a mailbox with no login of its
 * own, which its members see as a shared folder in the webmail. The sync keeps one per alias, on
 * the mailbox domain, described by the alias's address so members see which
 * alias it is, and the alias's list delivers to it besides forwarding (see sync.ts). Who the
 * members are is not kept here: the server takes that from the groups claim of the token a member
 * signs in to the webmail with, and rewrites it at every sign in.
 */

export type MailboxChanges = {
    created: number,
    updated: number,
    destroyed: number,
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

/**
 * The address of the mailbox of an alias, on the mailbox domain. An alias on Omega's main domain
 * keeps its local part; one on another of the sites' domains carries that domain too, joined with
 * `--`, which no local part holds (see mail/alias/schemas.ts), so two aliases never share a mailbox.
 */
export function mailboxAddressOf(aliasAddress: string, mailboxDomain: string): string {
    loadDomainConfig()
    const at = aliasAddress.lastIndexOf('@')
    const localPart = aliasAddress.slice(0, at).toLowerCase()
    const domain = aliasAddress.slice(at + 1).toLowerCase()
    const siteDomain = DomainContext.domainOfHost(domain)
    const onMainDomain = siteDomain !== null && siteDomain.main && Site.of(siteDomain.site).isRoot
    return `${onMainDomain ? localPart : `${localPart}--${domain}`}@${mailboxDomain}`
}

function localPartOf(address: string): string {
    return address.slice(0, address.lastIndexOf('@'))
}

/** The id a creation is sent under, see sync.ts. */
function creationId(address: string, index: number): string {
    return `${address.replace(/[^A-Za-z0-9_-]/g, '_')}-${index}`
}

/**
 * Makes the group accounts on the mailbox domain match the aliases: one per alias, named by the
 * alias and renamed with it, and none for an alias that is gone.
 *
 * Which group is an alias's goes by name first: the group named as the alias's mailbox is its,
 * whatever any alias remembers, which adopts a group a failed run created but did not store, and
 * makes stale ids harmless after the server was set up anew. An alias without one takes the group
 * it remembers, if no other alias took it, and renames it: that is a renamed alias, which keeps
 * its mail. The rest are created, and groups no alias took are destroyed. Renames and destructions
 * go to the server first, so a creation never meets a name about to be freed.
 */
export async function syncMailboxes(
    client: MailServerClient,
    accounts: MailServerAccount[],
    mailboxDomainId: string,
    webmail: MailServerWebmail,
): Promise<MailboxChanges> {
    const aliases: AliasMailbox[] = await prisma.mailAlias.findMany({
        select: { id: true, address: true, mailboxAccountId: true },
    })
    const groups = new Map<string, MailServerAccount>()
    for (const account of accounts) {
        if (account['@type'] === 'Group' && account.domainId === mailboxDomainId) groups.set(account.id, account)
    }
    const groupsByName = new Map<string, MailServerAccount>()
    groups.forEach(group => groupsByName.set(group.name.toLowerCase(), group))

    const wanted = aliases.map(alias => {
        const address = mailboxAddressOf(alias.address, webmail.domain)
        return { alias, address, name: localPartOf(address) }
    })

    const groupOfAlias = new Map<number, MailServerAccount>()
    const taken = new Set<string>()
    for (const { alias, name } of wanted) {
        const group = groupsByName.get(name)
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

    wanted.forEach(({ alias, address, name }, index) => {
        const group = groupOfAlias.get(alias.id)
        if (!group) {
            const id = creationId(address, index)
            create[id] = { '@type': 'Group', name, domainId: mailboxDomainId, description: alias.address }
            aliasOfCreation.set(id, alias.id)
            return
        }
        if (group.id !== alias.mailboxAccountId) remember.set(alias.id, group.id)
        const changes: Partial<WantedGroup> = {}
        if (group.name !== name) changes.name = name
        if ((group.description ?? '') !== alias.address) changes.description = alias.address
        if (Object.keys(changes).length > 0) update[group.id] = changes
    })
    const destroy = Array.from(groups.keys()).filter(id => !taken.has(id))

    if (Object.keys(update).length > 0 || destroy.length > 0) {
        await client.set('Account', { update, destroy })
    }
    if (Object.keys(create).length > 0) {
        const result = await client.set('Account', { create })
        for (const [id, created] of Object.entries(result.created ?? {})) {
            const aliasId = aliasOfCreation.get(id)
            if (aliasId !== undefined) remember.set(aliasId, created.id)
        }
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

    return { created: Object.keys(create).length, updated: Object.keys(update).length, destroyed: destroy.length }
}
