import '@pn-server-only'
import { mailServerClientFromEnv } from './client'
import { mailServerWebmail, mailboxesAreAvailable } from './constants'
import { syncDomains } from './domains'
import { syncMailingLists, wantedMailingLists } from './mailingLists'
import { destroyMailboxes, syncMailboxes } from './mailboxes'
import { revokeMemberships, syncMemberships } from './memberships'
import { syncUserMailboxes } from './userMailboxes'
import { forwardingAddressOf, syncForwardingScripts } from './forwarding'
import { validMailAddressDomains } from '@/services/mail/constants'
import logger from '@/lib/logger'
import type { MailServerWebmail } from './constants'
import type { MailServerClient } from './client'
import type { MailboxPlacement, SyncedDomains } from './domains'
import type { MailingListChanges, WantedMailingList } from './mailingLists'

export type SyncMailServerOptions = {
    /** The client to reach the server with. Defaults to one for EMAIL_ADMIN_URL. */
    client?: MailServerClient,
    /** The webmail whose host the mailboxes are on. Defaults to EMAIL_WEBMAIL_URL; null keeps no mailboxes. */
    webmail?: MailServerWebmail | null,
}

/** What a run did to the mailboxes, and what the server refused of it. */
type MailboxChanges = {
    created: number,
    updated: number,
    destroyed: number,
    /** The mailboxes whose forwarding was set. */
    scripts: number,
    /** The accounts whose memberships were changed. */
    memberships: number,
    refused: string[],
}

const NO_MAILBOXES: MailboxChanges = { created: 0, updated: 0, destroyed: 0, scripts: 0, memberships: 0, refused: [] }

/**
 * Brings the mail server in step with the database. Every mail domain of the sites exists as a
 * domain, and every address of ours, an alias's or a user's (see services/mail/address), is on the
 * server. The sites' domains are the only ones the sync creates, since sites.json is the one list
 * of them. The two the mailboxes take, the webmail's host and the forwarding domain, are the mail
 * installation's, so the infrastructure's plan for the server holds them and the sync only looks
 * them up. Without a webmail, every address is a mailing list that forwards: an alias to the
 * addresses it reaches, and a user's to their private email. With one, every address is a mailbox:
 * an alias a group at its own address (see mailboxes.ts), and a user the account they sign in to,
 * at theirs (see userMailboxes.ts). A mailbox keeps the mail, and while its address forwards it
 * sends a copy on (see forwarding.ts): a user's to their private email, and an alias's to a list of
 * the addresses it reaches, on a domain under the webmail's host. The users' accounts are made
 * members of the mailboxes of the aliases they receive, and of no other mailbox (see
 * memberships.ts). What the server holds under other domains is left alone, and the app has no
 * account of its own, since it sends without a login (see src/services/mail/send/constants.ts).
 * Run by the mail worker (src/workers/definitions.ts).
 *
 * A change the server refuses does not stop the run: every step does what it can and says what was
 * refused, and the run throws at its end naming all of it, so one alias the server will not take
 * does not keep the others from it. Without the domains the mailboxes take the run ends after the
 * domains, since no alias can be placed. It only takes those who no longer receive an alias out of
 * its mailbox first, so that a missing domain never lets someone keep a mailbox they were taken
 * off. A server that does not answer stops the run where it is.
 *
 * @returns false, since one run does all the work there is.
 * @throws once the run is through, when the server refused any change.
 */
export async function syncMailServer(options: SyncMailServerOptions = {}): Promise<false> {
    const client = options.client ?? mailServerClientFromEnv()
    const webmail = options.webmail === undefined ? webmailFromEnv() : options.webmail

    const domains = await syncDomains(client, validMailAddressDomains(), webmail)
    if (webmail && !domains.mailboxes) throw await aliasesLeftAsTheyWere(client, domains)

    // The lists first: the first run with mailboxes frees the aliases' addresses of the lists that
    // held them, which the mailboxes then take.
    const wantedLists = await wantedMailingLists(domains.siteDomainIdsByName, domains.mailboxes)
    const lists = await syncMailingLists(client, domains.siteDomainIdsByName, domains.mailboxes, wantedLists)
    const mailboxes = domains.mailboxes
        ? await syncMailboxesOfAddresses(client, domains.siteDomainIdsByName, domains.mailboxes, wantedLists)
        : NO_MAILBOXES

    report(domains, lists, mailboxes)
    return false
}

/**
 * Says what a run changed, and throws when the server refused any of it, naming what. A run that
 * changed nothing only says so at debug level, since that is every run but a few.
 */
function report(domains: SyncedDomains, lists: MailingListChanges, mailboxes: MailboxChanges): void {
    const changes = domains.created + mailboxes.created + mailboxes.updated + mailboxes.destroyed
        + lists.created + lists.updated + lists.destroyed + mailboxes.scripts + mailboxes.memberships
    if (changes > 0) {
        logger.info(`Mail server sync created ${domains.created} domains; created ${mailboxes.created}, updated ${
            mailboxes.updated} and destroyed ${mailboxes.destroyed} mailboxes; created ${lists.created}, updated ${
            lists.updated} and destroyed ${lists.destroyed} mailing lists; set the forwarding of ${
            mailboxes.scripts} mailboxes; and changed the memberships of ${mailboxes.memberships} accounts`)
    }
    const refused = [...domains.refused, ...lists.refused, ...mailboxes.refused]
    if (refused.length > 0) {
        throw new Error(`Mail server sync did the rest, and the server refused to ${namedRefusals(refused)}`)
    }
    if (changes === 0) logger.debug('Mail server sync found the server in step with the database')
}

/**
 * What a run ends with when the server lacks a domain the mailboxes take, so that no alias can be
 * placed. Those who no longer receive an alias are taken out of its mailbox first, so a missing
 * domain never lets someone keep a mailbox they were taken off.
 */
async function aliasesLeftAsTheyWere(client: MailServerClient, domains: SyncedDomains): Promise<Error> {
    // Without the webmail's domain no account has a sign in name, so there is no one to take out.
    const revoked = domains.accountDomainId === undefined
        ? { changed: 0, refused: [] }
        : await revokeMemberships(client, domains.siteDomainIdsByName, domains.accountDomainId)
    if (revoked.changed > 0) {
        logger.info(`Mail server sync took ${revoked.changed} accounts out of mailboxes their users no longer receive`)
    }
    const refused = [...domains.refused, ...revoked.refused]
    return new Error(`Mail server sync left the aliases as they were, since the server lacks ${
        domains.missingMailboxDomains.join(' and ')}, which the mailboxes take and the infrastructure's plan for the `
        + `mail server adds${refused.length > 0 ? `. The server also refused to ${namedRefusals(refused)}` : ''}`)
}

/** How many refusals a run names. A run that is refused everything says so every minute. */
const MAX_NAMED_REFUSALS = 20

/** The refusals of a run as its error names them: the first ones, and how many more there are. */
function namedRefusals(refused: string[]): string {
    const named = refused.slice(0, MAX_NAMED_REFUSALS).join('; ')
    const more = refused.length - MAX_NAMED_REFUSALS
    return more > 0 ? `${named}; and ${more} more changes` : named
}

/**
 * The mailboxes of the aliases and of the users, who the members of an alias's are and what each
 * sends on, in the order these depend on each other.
 */
async function syncMailboxesOfAddresses(
    client: MailServerClient,
    siteDomainIdsByName: Map<string, string>,
    { webmail, accountDomainId }: MailboxPlacement,
    wantedLists: Map<string, WantedMailingList>,
): Promise<MailboxChanges> {
    const accounts = await client.listAll('Account')
    const synced = await syncMailboxes(client, accounts, siteDomainIdsByName, accountDomainId)
    const users = await syncUserMailboxes(client, accounts, siteDomainIdsByName, accountDomainId)
    // The memberships before the stale mailboxes go, since the server keeps a group that has
    // members. The accounts of users who are gone go first for the same reason.
    const memberships = await syncMemberships(client, users.mailboxes, synced.mailboxes, synced.stale)
    const staleUsers = await destroyMailboxes(client, users.stale)
    const stale = await destroyMailboxes(client, synced.stale)
    const scripts = await syncForwardingScripts(client, [
        ...synced.mailboxes.map(({ accountId, aliasAddress }) => {
            const forwardTo = forwardingAddressOf(aliasAddress, webmail.domain)
            return {
                accountId, address: aliasAddress, forwardTo: wantedLists.has(forwardTo) ? forwardTo : null, personal: false,
            }
        }),
        ...users.mailboxes.map(({ accountId, address, username, forwardTo }) => (
            { accountId, address: address ?? username, forwardTo, personal: true }
        )),
    ], webmail.origin)
    return {
        created: synced.changes.created + users.changes.created,
        updated: synced.changes.updated + users.changes.updated,
        destroyed: stale.destroyed + staleUsers.destroyed,
        scripts: scripts.changed,
        memberships: memberships.changed,
        refused: [
            ...synced.refused, ...users.refused, ...memberships.refused, ...staleUsers.refused, ...stale.refused,
            ...scripts.refused,
        ],
    }
}

/** The webmail of the env when the installation keeps mailboxes, which takes a managed server too. */
function webmailFromEnv(): MailServerWebmail | null {
    return mailboxesAreAvailable ? mailServerWebmail : null
}
