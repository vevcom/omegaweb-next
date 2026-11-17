import '@pn-server-only'
import { creationId } from './client'
import { forwardingDomainOf } from './forwarding'
import logger from '@/lib/logger'
import type { MailServerClient } from './client'
import type { MailServerWebmail } from './constants'

const DOMAIN_DESCRIPTION = 'A domain of the sites, created by omegaweb-next'

/** Where the mailboxes are: the webmail they are read in, and the server's ids of the two domains they take. */
export type MailboxPlacement = {
    webmail: MailServerWebmail,
    /** The webmail's host as a domain, which the names users sign in by are on. */
    accountDomainId: string,
    /** The domain of the lists the mailboxes forward to, see forwarding.ts. */
    forwardingDomainId: string,
}

export type SyncedDomains = {
    /** The server's ids of the sites' mail domains, by name. A domain the server refused has none. */
    siteDomainIdsByName: Map<string, string>,
    /**
     * Where the mailboxes are. Null without a webmail, and when the server lacks a domain the
     * mailboxes take, which `missingMailboxDomains` then names.
     */
    mailboxes: MailboxPlacement | null,
    /** The webmail's host as a domain, also when the forwarding domain is missing. */
    accountDomainId: string | undefined,
    missingMailboxDomains: string[],
    created: number,
    /** What the server refused, see sync.ts. */
    refused: string[],
}

/**
 * Creates the mail domains of the sites that the server lacks, and looks up the two the mailboxes
 * take, the webmail's host and the forwarding domain under it, which are the infrastructure's to
 * add and are never created here. Domains are never destroyed: one the server has that is not ours
 * is only warned about, since mail for it may still be arriving.
 */
export async function syncDomains(
    client: MailServerClient,
    siteDomains: string[],
    webmail: MailServerWebmail | null,
): Promise<SyncedDomains> {
    const sites = siteDomains.map(name => name.toLowerCase())
    const mailboxDomains = (webmail ? [webmail.domain, forwardingDomainOf(webmail.domain)] : [])
        .map(name => name.toLowerCase())
    const ours = new Set([...sites, ...mailboxDomains])
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

    const missingSites = sites.filter(name => !idsByName.has(name))
    const namesByCreationId = new Map(missingSites.map((name, index) => [creationId(name, index), name]))
    const { created, refused } = await client.set('Domain', {
        create: Object.fromEntries(Array.from(namesByCreationId, ([id, name]) => [
            id,
            { name, description: DOMAIN_DESCRIPTION },
        ])),
    })
    for (const [id, domain] of Object.entries(created)) {
        const name = namesByCreationId.get(id)
        if (name !== undefined) idsByName.set(name, domain.id)
    }

    const [accountDomainId, forwardingDomainId] = mailboxDomains.map(name => idsByName.get(name))
    return {
        siteDomainIdsByName: new Map(sites.flatMap(name => {
            const id = idsByName.get(name)
            return id === undefined ? [] : [[name, id] as const]
        })),
        mailboxes: webmail && accountDomainId !== undefined && forwardingDomainId !== undefined
            ? { webmail, accountDomainId, forwardingDomainId }
            : null,
        accountDomainId,
        missingMailboxDomains: mailboxDomains.filter(name => !idsByName.has(name)),
        created: Object.keys(created).length,
        refused,
    }
}
