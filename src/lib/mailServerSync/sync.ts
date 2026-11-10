import '@pn-server-only'
import { mailServerClientFromEnv } from './client'
import { mailServerWebmail, mailboxesAreAvailable } from './constants'
import { destroyMailboxes, syncMailboxes } from './mailboxes'
import { syncMemberships } from './memberships'
import { forwardingAddressOf, forwardingDomainOf, syncForwardingScripts } from './forwarding'
import { validMailAddressDomains } from '@/services/mail/constants'
import { mailingListAddresses } from '@/services/mail/recipients'
import { prisma } from '@/prisma-pn-client-instance'
import logger from '@/lib/logger'
import type { MailServerWebmail } from './constants'
import type { MailboxChanges } from './mailboxes'
import type { MailServerClient, MailServerMailingList } from './client'

export type SyncMailServerOptions = {
    /** The client to reach the server with. Defaults to one for EMAIL_ADMIN_URL. */
    client?: MailServerClient,
    /** The webmail whose host the mailboxes are on. Defaults to EMAIL_WEBMAIL_URL; null keeps no mailboxes. */
    webmail?: MailServerWebmail | null,
}

type WantedDomain = {
    name: string,
    description: string,
}

/** A list as the sync wants it on the server. */
type WantedMailingList = {
    name: string,
    domainId: string,
    /** Null for an alias without one, since the server refuses an empty description. */
    description: string | null,
    recipients: Record<string, true>,
}

type MailingListChanges = {
    created: number,
    updated: number,
    destroyed: number,
}

const DOMAIN_DESCRIPTION = 'A domain of the sites, created by omegaweb-next'
const ACCOUNT_DOMAIN_DESCRIPTION = 'The domain of the accounts of those who sign in to the webmail, created by omegaweb-next'
const FORWARDING_DOMAIN_DESCRIPTION = 'The domain of the lists the mailboxes forward to, created by omegaweb-next'
const NO_MAILBOX_CHANGES: MailboxChanges = { created: 0, updated: 0, destroyed: 0 }

/**
 * Brings the mail server in step with the database. Every mail domain of the sites exists as a
 * domain. Without a webmail, every alias is a mailing list that forwards to the addresses it
 * reaches. With one, every alias is a mailbox at its own address (see mailboxes.ts), which keeps
 * the mail and forwards a copy to a list of those addresses on a domain of its own (see
 * forwarding.ts): the webmail's host is the domain of the accounts that sign in, and the lists are
 * on a domain under it. Those accounts are made members of the mailboxes of the aliases their
 * users receive, and of no other mailbox (see memberships.ts). What the server holds under other
 * domains is left alone, and no account is created: the app has none of its own, since it sends
 * without a login (see src/services/mail/send/constants.ts). Run by the mail worker
 * (src/workers/definitions.ts).
 *
 * @returns false, since one run does all the work there is.
 */
export async function syncMailServer(options: SyncMailServerOptions = {}): Promise<false> {
    const client = options.client ?? mailServerClientFromEnv()
    const webmail = options.webmail === undefined ? webmailFromEnv() : options.webmail

    const siteDomains = validMailAddressDomains().map(name => ({ name, description: DOMAIN_DESCRIPTION }))
    const forwardingDomain = webmail ? forwardingDomainOf(webmail.domain) : null
    const domains = await syncDomains(client, [
        ...siteDomains,
        ...(webmail ? [{ name: webmail.domain, description: ACCOUNT_DOMAIN_DESCRIPTION }] : []),
        ...(forwardingDomain ? [{ name: forwardingDomain, description: FORWARDING_DOMAIN_DESCRIPTION }] : []),
    ])
    const siteDomainIdsByName = new Map(siteDomains.flatMap(({ name }) => {
        const id = domains.idsByName.get(name)
        return id === undefined ? [] : [[name, id] as const]
    }))
    const forwardingDomainId = forwardingDomain ? domains.idsByName.get(forwardingDomain) : undefined
    const accountDomainId = webmail ? domains.idsByName.get(webmail.domain) : undefined
    if (webmail && (forwardingDomainId === undefined || accountDomainId === undefined)) {
        logger.warn('Mail server sync keeps no mailboxes, since the domains they take could not be made')
    }
    const forwarding = webmail && forwardingDomainId !== undefined && accountDomainId !== undefined
        ? { webmail, domainId: forwardingDomainId, accountDomainId }
        : null

    // The lists first: the first run with mailboxes frees the aliases' addresses of the lists that
    // held them, which the mailboxes then take.
    const wantedLists = await wantedMailingLists(siteDomainIdsByName, forwarding)
    const listDomainIdsByName = new Map(siteDomainIdsByName)
    if (forwardingDomain && forwardingDomainId !== undefined) listDomainIdsByName.set(forwardingDomain, forwardingDomainId)
    const lists = await syncMailingLists(client, listDomainIdsByName, wantedLists)

    let mailboxes = NO_MAILBOX_CHANGES
    let scripts = 0
    let memberships = 0
    if (forwarding) {
        const accounts = await client.listAll('Account')
        const synced = await syncMailboxes(client, accounts, siteDomainIdsByName, forwarding.accountDomainId)
        mailboxes = synced.changes
        // The memberships before the stale mailboxes go, since the server keeps a group that has members.
        memberships = await syncMemberships(client, accounts, forwarding.accountDomainId, synced.mailboxes, synced.stale)
        await destroyMailboxes(client, synced.stale)
        scripts = await syncForwardingScripts(client, synced.mailboxes.map(mailbox => {
            const forwardTo = forwardingAddressOf(mailbox.aliasAddress, forwarding.webmail.domain)
            return { ...mailbox, forwardTo: wantedLists.has(forwardTo) ? forwardTo : null }
        }), forwarding.webmail.origin)
    }

    const changes = domains.created + mailboxes.created + mailboxes.updated + mailboxes.destroyed
        + lists.created + lists.updated + lists.destroyed + scripts + memberships
    if (changes > 0) {
        logger.info(`Mail server sync created ${domains.created} domains; created ${mailboxes.created}, updated ${
            mailboxes.updated} and destroyed ${mailboxes.destroyed} mailboxes; created ${lists.created}, updated ${
            lists.updated} and destroyed ${lists.destroyed} mailing lists; set the forwarding of ${
            scripts} mailboxes; and changed the memberships of ${memberships} accounts`)
    } else {
        logger.debug('Mail server sync found the server in step with the database')
    }
    return false
}

/** The webmail of the env when the installation keeps mailboxes, which takes a managed server too. */
function webmailFromEnv(): MailServerWebmail | null {
    return mailboxesAreAvailable ? mailServerWebmail : null
}

/** The local part and the domain of an address, the domain lower-cased as domains are matched. */
function splitAddress(address: string): { localPart: string, domain: string } {
    const at = address.lastIndexOf('@')
    return { localPart: address.slice(0, at), domain: address.slice(at + 1).toLowerCase() }
}

/**
 * The id a creation is sent under and reported back by. JMAP ids allow only letters, digits, _ and
 * -, so an address is made safe, with its index so two addresses cannot end up alike.
 */
function creationId(address: string, index: number): string {
    return `${address.replace(/[^A-Za-z0-9_-]/g, '_')}-${index}`
}

/**
 * Creates the domains wanted that the server lacks: the mail domains of the sites, and the mailbox
 * domain. Domains are never destroyed: one the server has that is not ours is only warned about,
 * since mail for it may still be arriving.
 */
async function syncDomains(
    client: MailServerClient,
    wanted: WantedDomain[],
): Promise<{ idsByName: Map<string, string>, created: number }> {
    const ours = new Map(wanted.map(domain => [domain.name.toLowerCase(), domain.description]))
    const existing = await client.listAll('Domain')

    const idsByName = new Map<string, string>()
    const foreign: string[] = []
    for (const domain of existing) {
        const name = domain.name.toLowerCase()
        if (ours.has(name)) idsByName.set(name, domain.id)
        else foreign.push(domain.name)
    }
    if (foreign.length > 0) {
        logger.warn(`Mail server has domains that are not ours, which are left alone: ${foreign.join(', ')}`)
    }

    const missing = Array.from(ours.keys()).filter(name => !idsByName.has(name))
    if (missing.length > 0) {
        const namesByCreationId = new Map(missing.map((name, index) => [creationId(name, index), name]))
        const result = await client.set('Domain', {
            create: Object.fromEntries(Array.from(namesByCreationId, ([id, name]) => [
                id,
                { name, description: ours.get(name) },
            ])),
        })
        for (const [id, created] of Object.entries(result.created ?? {})) {
            const name = namesByCreationId.get(id)
            if (name !== undefined) idsByName.set(name, created.id)
        }
    }
    return { idsByName, created: missing.length }
}

/**
 * The lists the server should have, by their addresses. Without mailboxes, every alias is a list
 * at its own address, forwarding to the addresses it reaches. With them the alias's address is its
 * mailbox's, so the list is on the forwarding domain, for the mailbox to send its copies to, and an
 * alias that reaches no one has none.
 */
async function wantedMailingLists(
    siteDomainIdsByName: Map<string, string>,
    forwarding: { webmail: MailServerWebmail, domainId: string } | null,
): Promise<Map<string, WantedMailingList>> {
    const aliases = await prisma.mailAlias.findMany({
        select: {
            address: true,
            description: true,
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
        if (!forwarding) {
            wanted.set(alias.address.toLowerCase(), { name: localPart.toLowerCase(), domainId, description, recipients })
            continue
        }
        if (addresses.length === 0) continue
        const address = forwardingAddressOf(alias.address, forwarding.webmail.domain)
        wanted.set(address, {
            name: address.slice(0, address.lastIndexOf('@')),
            domainId: forwarding.domainId,
            description,
            recipients,
        })
    }
    if (unplaced.length > 0) {
        logger.warn(`Mail server sync skips aliases on domains that are no longer the sites': ${unplaced.join(', ')}`)
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
 * are created, changed ones updated in place, and the rest destroyed. Lists on other domains are
 * left alone.
 */
async function syncMailingLists(
    client: MailServerClient,
    domainIdsByName: Map<string, string>,
    wanted: Map<string, WantedMailingList>,
): Promise<MailingListChanges> {
    const existing = await client.listAll('MailingList')
    const domainNamesById = new Map(Array.from(domainIdsByName, ([name, id]) => [id, name]))

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

    const changes = {
        created: Object.keys(create).length,
        updated: Object.keys(update).length,
        destroyed: destroy.length,
    }
    if (changes.created + changes.updated + changes.destroyed > 0) {
        await client.set('MailingList', { create, update, destroy })
    }
    return changes
}
