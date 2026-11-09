import '@pn-server-only'
import { mailServerClientFromEnv } from './client'
import { mailServerSender } from './constants'
import { validMailAddressDomains } from '@/services/mail/constants'
import { resolveMailRecipients } from '@/services/mail/recipients'
import { prisma } from '@/prisma-pn-client-instance'
import logger from '@/lib/logger'
import type { MailServerClient, MailServerMailingList, MailServerPasswordCredentials } from './client'

/** The account the app sends as, which the sync keeps on the server. */
export type MailServerSenderAccount = {
    address: string,
    password: string,
}

export type SyncMailServerOptions = {
    /** The client to reach the server with. Defaults to one for EMAIL_ADMIN_URL. */
    client?: MailServerClient,
    /** The sender account to keep. Defaults to EMAIL_USER and EMAIL_PASSWORD; null keeps none. */
    sender?: MailServerSenderAccount | null,
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
const SENDER_DESCRIPTION = 'The account omegaweb-next sends mail as'

/**
 * Brings the mail server in step with the database: every mail domain of the sites exists as a
 * domain, every alias as a mailing list with the addresses it reaches as recipients, and the
 * sender account exists with its password. What the server holds under other domains is left
 * alone. Run by the mail worker (src/workers/definitions.ts).
 *
 * @returns false, since one run does all the work there is.
 */
export async function syncMailServer(options: SyncMailServerOptions = {}): Promise<false> {
    const client = options.client ?? mailServerClientFromEnv()
    const sender = options.sender === undefined ? senderFromEnv() : options.sender

    const domains = await syncDomains(client)
    const lists = await syncMailingLists(client, domains.idsByName)
    const senderCreated = await syncSenderAccount(client, domains.idsByName, sender)

    const changes = domains.created + lists.created + lists.updated + lists.destroyed + (senderCreated ? 1 : 0)
    if (changes > 0) {
        logger.info(`Mail server sync created ${domains.created} domains, created ${lists.created}, updated ${
            lists.updated} and destroyed ${lists.destroyed} mailing lists${
            senderCreated ? ', and created the sender account' : ''}`)
    } else {
        logger.debug('Mail server sync found the server in step with the database')
    }
    return false
}

function senderFromEnv(): MailServerSenderAccount | null {
    const { address, password } = mailServerSender
    if (!address || !password) {
        logger.warn('Mail server sync keeps no sender account, since EMAIL_USER and EMAIL_PASSWORD are not both set')
        return null
    }
    return { address, password }
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
 * Creates the mail domains of the sites that the server lacks. Domains are never destroyed: one
 * the server has that is not ours is only warned about, since mail for it may still be arriving.
 */
async function syncDomains(client: MailServerClient): Promise<{ idsByName: Map<string, string>, created: number }> {
    const ours = validMailAddressDomains().map(domain => domain.toLowerCase())
    const existing = await client.listAll('Domain')

    const idsByName = new Map<string, string>()
    const foreign: string[] = []
    for (const domain of existing) {
        const name = domain.name.toLowerCase()
        if (ours.includes(name)) idsByName.set(name, domain.id)
        else foreign.push(domain.name)
    }
    if (foreign.length > 0) {
        logger.warn(`Mail server has domains that are not ours, which are left alone: ${foreign.join(', ')}`)
    }

    const missing = ours.filter(name => !idsByName.has(name))
    if (missing.length > 0) {
        const namesByCreationId = new Map(missing.map((name, index) => [creationId(name, index), name]))
        const result = await client.set('Domain', {
            create: Object.fromEntries(Array.from(namesByCreationId, ([id, name]) => [
                id,
                { name, description: DOMAIN_DESCRIPTION },
            ])),
        })
        for (const [id, created] of Object.entries(result.created ?? {})) {
            const name = namesByCreationId.get(id)
            if (name !== undefined) idsByName.set(name, created.id)
        }
    }
    return { idsByName, created: missing.length }
}

/** Every alias as the list it should be on the server, by its address. */
async function wantedMailingLists(domainIdsByName: Map<string, string>): Promise<Map<string, WantedMailingList>> {
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
        const domainId = domainIdsByName.get(domain)
        if (domainId === undefined) {
            unplaced.push(alias.address)
            continue
        }
        const recipients = await resolveMailRecipients(prisma, {
            addresses: [],
            mailingListIds: alias.mailingLists.map(relation => relation.mailingListId),
        })
        wanted.set(alias.address.toLowerCase(), {
            name: localPart.toLowerCase(),
            domainId,
            description: alias.description === '' ? null : alias.description,
            recipients: Object.fromEntries(recipients.map(recipient => [recipient.address.toLowerCase(), true as const])),
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
 * Makes the server's mailing lists on our domains match the aliases: one list per alias, named by
 * its local part, forwarding to the distinct addresses the alias's mailing lists reach. Lists on
 * other domains are left alone.
 */
async function syncMailingLists(
    client: MailServerClient,
    domainIdsByName: Map<string, string>,
): Promise<MailingListChanges> {
    const wanted = await wantedMailingLists(domainIdsByName)
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

/**
 * Makes sure the sender account exists with its password. The password cannot be read back, so it
 * is written on every run, which is also how a changed EMAIL_PASSWORD takes effect. No other
 * account is touched.
 *
 * @returns whether the account was created.
 */
async function syncSenderAccount(
    client: MailServerClient,
    domainIdsByName: Map<string, string>,
    sender: MailServerSenderAccount | null,
): Promise<boolean> {
    if (sender === null) return false

    const { localPart, domain } = splitAddress(sender.address)
    const domainId = domainIdsByName.get(domain)
    if (domainId === undefined) {
        logger.warn(`Mail server sync leaves the sender account ${sender.address} alone, since ${
            domain} is not one of our mail domains`)
        return false
    }

    const credentials: MailServerPasswordCredentials = { 0: { '@type': 'Password', secret: sender.password } }
    const accounts = await client.listAll('Account')
    const existing = accounts.find(account =>
        account.domainId === domainId && account.name.toLowerCase() === localPart.toLowerCase()
    )
    if (existing) {
        await client.set('Account', { update: { [existing.id]: { credentials } } })
        return false
    }

    await client.set('Account', {
        create: {
            [creationId(sender.address, 0)]: {
                '@type': 'User',
                name: localPart,
                domainId,
                description: SENDER_DESCRIPTION,
                credentials,
                roles: { '@type': 'User' },
            },
        },
    })
    return true
}
