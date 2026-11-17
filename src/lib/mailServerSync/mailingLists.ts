import '@pn-server-only'
import { creationId } from './client'
import { forwardingAddressOf, forwardingDomainOf } from './forwarding'
import { mailingListAddresses } from '@/services/mail/recipients'
import { userPartitions } from '@/services/users/constants'
import { prisma } from '@/prisma-pn-client-instance'
import logger from '@/lib/logger'
import type { MailServerClient, MailServerMailingList } from './client'
import type { MailboxPlacement } from './domains'

/**
 * The mailing lists of the server: what forwards mail to the addresses behind an address of ours.
 * Without mailboxes every address is a list. With them an address is its mailbox's, and the list
 * of an alias is what its mailbox sends a copy to, see forwarding.ts.
 */

/** A list as the sync wants it on the server. */
export type WantedMailingList = {
    name: string,
    domainId: string,
    /** Null for an alias without one, since the server refuses an empty description. */
    description: string | null,
    recipients: Record<string, true>,
}

export type MailingListChanges = {
    created: number,
    updated: number,
    destroyed: number,
    refused: string[],
}

/** The local part and the domain of an address, the domain lower-cased as domains are matched. */
function splitAddress(address: string): { localPart: string, domain: string } {
    const at = address.lastIndexOf('@')
    return { localPart: address.slice(0, at), domain: address.slice(at + 1).toLowerCase() }
}

/**
 * The lists the server should have, by their addresses. Without mailboxes, every address is a list
 * of its own, forwarding whatever its `forwardsToPrivateEmail` says, since nothing else would keep
 * the mail: an alias to the addresses it reaches, and a user's to their private email. With them
 * an address is its mailbox's. The list of an alias is then on the forwarding domain, for the
 * mailbox to send its copies to, and an alias that reaches no one or does not forward has none. A
 * user's mailbox sends its copies straight to their private email, so a user has no list.
 */
export async function wantedMailingLists(
    siteDomainIdsByName: Map<string, string>,
    mailboxes: MailboxPlacement | null,
): Promise<Map<string, WantedMailingList>> {
    const aliases = await prisma.mailAlias.findMany({
        select: {
            address: true,
            description: true,
            mailAddress: { select: { forwardsToPrivateEmail: true } },
            mailingLists: { select: { mailingListId: true } },
        },
    })

    const wanted = new Map<string, WantedMailingList>()
    const unplaced: string[] = []
    for (const alias of aliases) {
        const { localPart, domain } = splitAddress(alias.address)
        const domainId = siteDomainIdsByName.get(domain)
        if (domainId === undefined) {
            unplaced.push(alias.address)
            continue
        }
        const addresses = await mailingListAddresses(
            prisma,
            alias.mailingLists.map(relation => relation.mailingListId),
        )
        const recipients = Object.fromEntries(addresses.map(address => [address.toLowerCase(), true as const]))
        const description = alias.description === '' ? null : alias.description
        if (!mailboxes) {
            wanted.set(alias.address.toLowerCase(), { name: localPart.toLowerCase(), domainId, description, recipients })
            continue
        }
        if (addresses.length === 0 || !alias.mailAddress.forwardsToPrivateEmail) continue
        const address = forwardingAddressOf(alias.address, mailboxes.webmail.domain)
        wanted.set(address, {
            name: address.slice(0, address.lastIndexOf('@')),
            domainId: mailboxes.forwardingDomainId,
            description,
            recipients,
        })
    }
    if (!mailboxes) {
        const users = await prisma.user.findMany({
            where: { ...userPartitions.unarchived, vevenMailAddress: { not: null } },
            select: { email: true, firstname: true, lastname: true, vevenMailAddress: true },
        })
        for (const user of users) {
            if (user.vevenMailAddress === null) continue
            const address = user.vevenMailAddress.toLowerCase()
            const { localPart, domain } = splitAddress(address)
            const domainId = siteDomainIdsByName.get(domain)
            if (domainId === undefined) {
                unplaced.push(address)
                continue
            }
            // An address that is the user's private email too would be sent on to itself.
            if (user.email.toLowerCase() === address) continue
            wanted.set(address, {
                name: localPart,
                domainId,
                description: `${user.firstname} ${user.lastname}`,
                recipients: { [user.email.toLowerCase()]: true },
            })
        }
    }
    if (unplaced.length > 0) {
        logger.warn(`Mail server sync skips addresses on domains the server does not hold for the sites: ${
            unplaced.join(', ')}`)
    }
    return wanted
}

/** Whether two lists of addresses hold the same addresses, whatever their case and order. */
function sameAddresses(first: string[], second: string[]): boolean {
    const firstSet = new Set(first.map(address => address.toLowerCase()))
    const secondSet = new Set(second.map(address => address.toLowerCase()))
    return firstSet.size === secondSet.size && Array.from(firstSet).every(address => secondSet.has(address))
}

/** The fields of a list that differ from what is wanted, or null when none do. */
function changesTo(list: MailServerMailingList, target: WantedMailingList): Partial<WantedMailingList> | null {
    const changes: Partial<WantedMailingList> = {}
    if (!sameAddresses(Object.keys(list.recipients ?? {}), Object.keys(target.recipients))) {
        changes.recipients = target.recipients
    }
    if ((list.description ?? '') !== (target.description ?? '')) {
        changes.description = target.description
    }
    return Object.keys(changes).length > 0 ? changes : null
}

/**
 * Makes the server's mailing lists on our domains match the wanted ones, by address: missing ones
 * are created, changed ones updated in place, and the rest destroyed. Ours are the sites' domains
 * and, with mailboxes, the domain the mailboxes forward to. Lists on other domains are left alone.
 */
export async function syncMailingLists(
    client: MailServerClient,
    siteDomainIdsByName: Map<string, string>,
    mailboxes: MailboxPlacement | null,
    wanted: Map<string, WantedMailingList>,
): Promise<MailingListChanges> {
    const existing = await client.listAll('MailingList')
    const domainNamesById = new Map(Array.from(siteDomainIdsByName, ([name, id]) => [id, name]))
    if (mailboxes) domainNamesById.set(mailboxes.forwardingDomainId, forwardingDomainOf(mailboxes.webmail.domain))

    const create: Record<string, WantedMailingList> = {}
    const update: Record<string, Partial<WantedMailingList>> = {}
    const destroy: string[] = []
    const foreign: string[] = []
    const kept = new Set<string>()

    for (const list of existing) {
        const domain = domainNamesById.get(list.domainId)
        if (domain === undefined) {
            foreign.push(list.emailAddress ?? list.name)
            continue
        }
        const address = `${list.name}@${domain}`.toLowerCase()
        const target = wanted.get(address)
        if (target === undefined) {
            destroy.push(list.id)
            continue
        }
        kept.add(address)
        const changes = changesTo(list, target)
        if (changes) update[list.id] = changes
    }
    Array.from(wanted)
        .filter(([address]) => !kept.has(address))
        .forEach(([address, target], index) => {
            create[creationId(address, index)] = target
        })

    if (foreign.length > 0) {
        logger.warn(`Mail server has mailing lists on domains that are not ours, which are left alone: ${
            foreign.join(', ')}`)
    }

    const outcome = await client.set('MailingList', { create, update, destroy })
    return { ...outcome, created: Object.keys(outcome.created).length }
}
