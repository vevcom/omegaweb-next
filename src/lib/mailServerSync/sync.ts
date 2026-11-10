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
import type { MailServerClient, MailServerMailingList } from './client'

export type SyncMailServerOptions = {
    /** The client to reach the server with. Defaults to one for EMAIL_ADMIN_URL. */
    client?: MailServerClient,
    /** The webmail whose host the mailboxes are on. Defaults to EMAIL_WEBMAIL_URL; null keeps no mailboxes. */
    webmail?: MailServerWebmail | null,
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
    refused: string[],
}

/** Said with every missing domain, so that whoever reads the log knows where to add it. */
const DOMAINS_ARE_THE_INFRASTRUCTURES = 'Domains are added in the infrastructure\'s plan for the mail server.'

/**
 * Brings the mail server in step with the database. The domains are not the sync's to make: the
 * infrastructure's plan holds them, the mail domains of the sites and the two the mailboxes take,
 * and the sync only looks them up. Without a webmail, every alias is a mailing list that forwards to the addresses it
 * reaches. With one, every alias is a mailbox at its own address (see mailboxes.ts), which keeps
 * the mail and forwards a copy to a list of those addresses on a domain of its own (see
 * forwarding.ts): the webmail's host is the domain of the accounts that sign in, and the lists are
 * on a domain under it. Those accounts are made members of the mailboxes of the aliases their
 * users receive, and of no other mailbox (see memberships.ts). What the server holds under other
 * domains is left alone, and no account is created: the app has none of its own, since it sends
 * without a login (see src/services/mail/send/constants.ts). Run by the mail worker
 * (src/workers/definitions.ts).
 *
 * A change the server refuses does not stop the run: every step does what it can and says what was
 * refused, and the run throws at its end naming all of it, so one alias the server will not take
 * does not keep the others from it. A site domain the server lacks is treated the same way: its
 * aliases are skipped and the run throws at its end naming it. Without the domains the mailboxes
 * take the run ends at once, since no alias can be placed. A server that does not answer stops the
 * run where it is.
 *
 * @returns false, since one run does all the work there is.
 * @throws once the run is through, when the server refused any change or lacks a site's domain.
 */
export async function syncMailServer(options: SyncMailServerOptions = {}): Promise<false> {
    const client = options.client ?? mailServerClientFromEnv()
    const webmail = options.webmail === undefined ? webmailFromEnv() : options.webmail

    const siteDomains = validMailAddressDomains().map(name => name.toLowerCase())
    const forwardingDomain = webmail ? forwardingDomainOf(webmail.domain) : null
    const mailboxDomains = webmail && forwardingDomain ? [webmail.domain.toLowerCase(), forwardingDomain] : []
    const domainIdsByName = await readDomains(client, [...siteDomains, ...mailboxDomains])

    const missingMailboxDomains = mailboxDomains.filter(name => !domainIdsByName.has(name))
    if (missingMailboxDomains.length > 0) {
        throw new Error(`Mail server sync left the aliases as they were, since the server lacks ${
            missingMailboxDomains.join(' and ')}, which the mailboxes take. ${DOMAINS_ARE_THE_INFRASTRUCTURES}`)
    }
    const missingSiteDomains = siteDomains.filter(name => !domainIdsByName.has(name))
    const siteDomainIdsByName = new Map(siteDomains.flatMap(name => {
        const id = domainIdsByName.get(name)
        return id === undefined ? [] : [[name, id] as const]
    }))
    const forwardingDomainId = forwardingDomain ? domainIdsByName.get(forwardingDomain) : undefined
    const accountDomainId = webmail ? domainIdsByName.get(webmail.domain.toLowerCase()) : undefined
    const forwarding = webmail && forwardingDomainId !== undefined && accountDomainId !== undefined
        ? { webmail, domainId: forwardingDomainId, accountDomainId }
        : null

    // The lists first: the first run with mailboxes frees the aliases' addresses of the lists that
    // held them, which the mailboxes then take.
    const wantedLists = await wantedMailingLists(siteDomainIdsByName, forwarding)
    const listDomainIdsByName = new Map(siteDomainIdsByName)
    if (forwardingDomain && forwardingDomainId !== undefined) listDomainIdsByName.set(forwardingDomain, forwardingDomainId)
    const lists = await syncMailingLists(client, listDomainIdsByName, wantedLists)

    const mailboxes = forwarding
        ? await syncMailboxesOfAliases(client, siteDomainIdsByName, forwarding, wantedLists)
        : { created: 0, updated: 0, destroyed: 0, scripts: 0, memberships: 0, refused: [] }

    const changes = mailboxes.created + mailboxes.updated + mailboxes.destroyed
        + lists.created + lists.updated + lists.destroyed + mailboxes.scripts + mailboxes.memberships
    if (changes > 0) {
        logger.info(`Mail server sync created ${mailboxes.created}, updated ${
            mailboxes.updated} and destroyed ${mailboxes.destroyed} mailboxes; created ${lists.created}, updated ${
            lists.updated} and destroyed ${lists.destroyed} mailing lists; set the forwarding of ${
            mailboxes.scripts} mailboxes; and changed the memberships of ${mailboxes.memberships} accounts`)
    }
    const refused = [...lists.refused, ...mailboxes.refused]
    const failures = [
        ...(missingSiteDomains.length > 0 ? [
            `the server lacks ${missingSiteDomains.join(' and ')}, whose aliases were skipped. ${
                DOMAINS_ARE_THE_INFRASTRUCTURES}`,
        ] : []),
        ...(refused.length > 0 ? [`the server refused to ${refused.join('; ')}`] : []),
    ]
    if (failures.length > 0) {
        throw new Error(`Mail server sync did the rest, and ${failures.join(' Also, ')}`)
    }
    if (changes === 0) logger.debug('Mail server sync found the server in step with the database')
    return false
}

/** The mailboxes of the aliases, who their members are and what they forward, in the order these depend on each other. */
async function syncMailboxesOfAliases(
    client: MailServerClient,
    siteDomainIdsByName: Map<string, string>,
    forwarding: { webmail: MailServerWebmail, accountDomainId: string },
    wantedLists: Map<string, WantedMailingList>,
) {
    const accounts = await client.listAll('Account')
    const synced = await syncMailboxes(client, accounts, siteDomainIdsByName, forwarding.accountDomainId)
    // The memberships before the stale mailboxes go, since the server keeps a group that has members.
    const memberships = await syncMemberships(
        client, accounts, forwarding.accountDomainId, synced.mailboxes, synced.stale
    )
    const stale = await destroyMailboxes(client, synced.stale)
    const scripts = await syncForwardingScripts(client, synced.mailboxes.map(mailbox => {
        const forwardTo = forwardingAddressOf(mailbox.aliasAddress, forwarding.webmail.domain)
        return { ...mailbox, forwardTo: wantedLists.has(forwardTo) ? forwardTo : null }
    }), forwarding.webmail.origin)
    return {
        ...synced.changes,
        destroyed: stale.destroyed,
        scripts: scripts.changed,
        memberships: memberships.changed,
        refused: [...synced.refused, ...memberships.refused, ...stale.refused, ...scripts.refused],
    }
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
 * The ids of the domains wanted that the server has, by their names. A domain the server has that
 * is not among them is only warned about, since mail for it may still be arriving.
 */
async function readDomains(client: MailServerClient, wanted: string[]): Promise<Map<string, string>> {
    const idsByName = new Map<string, string>()
    const foreign: string[] = []
    for (const domain of await client.listAll('Domain')) {
        const name = domain.name.toLowerCase()
        if (wanted.includes(name)) idsByName.set(name, domain.id)
        else foreign.push(domain.name)
    }
    if (foreign.length > 0) {
        logger.warn(`Mail server has domains that are not ours, which are left alone: ${foreign.join(', ')}`)
    }
    return idsByName
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
        logger.warn(`Mail server sync skips aliases on domains the server does not hold for the sites: ${
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

    const outcome = await client.set('MailingList', { create, update, destroy })
    return { ...outcome, created: Object.keys(outcome.created).length }
}
