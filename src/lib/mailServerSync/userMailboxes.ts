import '@pn-server-only'
import { creationId } from './mailboxes'
import { prisma } from '@/prisma-pn-client-instance'
import logger from '@/lib/logger'
import type { MailServerAccount, MailServerAccountAlias, MailServerClient } from './client'

/**
 * The mailbox of a user is an account of their own on the mail server, at the address they have
 * here, see services/mail/address. The server signs a user in by the name it builds from their
 * username and the webmail's host, such as kari@mail.omega.ntnu.no, which is their sign in name.
 * An account the server made at a first sign in is at that name. The sync moves it to the user's
 * address and keeps the name as an alias of the account, by which the server signs the user in
 * all the same. So an account is its user's by its sign in name wherever its address is, and a
 * user whose address changes keeps their mail. A user who has not signed in is given their
 * account ahead, so mail to their address has somewhere to arrive.
 *
 * Only accounts with a sign in name are touched: any other user account, such as postmaster, is
 * not ours. One whose sign in name is no user's is the mailbox of a user who was deleted, and is
 * stale, for the caller to destroy.
 */

/** The mailbox of a user as it is on the server once the sync has run. */
export type UserMailbox = {
    accountId: string,
    username: string,
    /** The address the mailbox is to be at, or null when its account stays where the server made it. */
    address: string | null,
    /** The private email the mail is also sent on to, or null when it is not sent on. */
    forwardTo: string | null,
    /** The groups the account is a member of, as the server has them. */
    memberGroupIds: string[],
}

export type SyncedUserMailboxes = {
    changes: { created: number, updated: number },
    mailboxes: UserMailbox[],
    /** The accounts of users who are gone, which are still on the server. */
    stale: string[],
    /** What the server refused, see sync.ts. A user whose account was refused is not among `mailboxes`. */
    refused: string[],
}

type WantedAccount = {
    '@type': 'User',
    name: string,
    domainId: string,
    description: string,
    aliases: Record<string, MailServerAccountAlias>,
}

/** A username the server takes as what stands before the @ of a sign in name. */
const SIGN_IN_NAME = /^[a-z0-9][a-z0-9._+-]{0,63}$/

/** The username an account is signed in to by, or null for an account no user of ours signs in to. */
function signInNameOf(account: MailServerAccount, accountDomainId: string): string | null {
    if (account.domainId === accountDomainId) return account.name.toLowerCase()
    const alias = Object.values(account.aliases ?? {}).find(({ domainId }) => domainId === accountDomainId)
    return alias ? alias.name.toLowerCase() : null
}

/**
 * The aliases an account is to have for its user to sign in by `username`, or null when it has
 * them: its aliases on other domains as they are, and the sign in name as the one on the
 * webmail's.
 */
function aliasesToSignInBy(
    account: MailServerAccount,
    username: string,
    accountDomainId: string,
): Record<string, MailServerAccountAlias> | null {
    const aliases = Object.values(account.aliases ?? {})
    const signInNames = aliases.filter(({ domainId }) => domainId === accountDomainId)
    if (signInNames.length === 1 && signInNames[0].name.toLowerCase() === username && signInNames[0].enable !== false) {
        return null
    }
    return Object.fromEntries([
        ...aliases.filter(({ domainId }) => domainId !== accountDomainId),
        { name: username, domainId: accountDomainId, enable: true },
    ].map((alias, index) => [String(index), alias]))
}

/**
 * Makes the accounts of the users match the addresses they have: every user with an address has
 * an account at it, which they sign in to by their sign in name.
 *
 * Which account is a user's goes by its sign in name. A user without one takes the account at
 * their address when the name it is signed in to by is no user's, which is a user whose username
 * changed. The rest are created. An account is only moved for a user who has an address on a domain the server
 * holds for the sites, and an archived user's is left where it is. Moves go to the server first,
 * so a creation never meets an address about to be freed. An account whose move the server
 * refused is still its user's, by its sign in name, and the next run moves it.
 */
export async function syncUserMailboxes(
    client: MailServerClient,
    accounts: MailServerAccount[],
    siteDomainIdsByName: Map<string, string>,
    accountDomainId: string,
): Promise<SyncedUserMailboxes> {
    const users = await prisma.user.findMany({
        select: {
            username: true,
            email: true,
            firstname: true,
            lastname: true,
            archived: true,
            mailAddress: { select: { address: true, forwardsToPrivateEmail: true } },
        },
    })
    const usernames = new Set(users.map(user => user.username.toLowerCase()))
    const domainNamesById = new Map(Array.from(siteDomainIdsByName, ([name, id]) => [id, name]))

    const signedInTo = new Map<string, MailServerAccount>()
    const accountsByAddress = new Map<string, MailServerAccount>()
    for (const account of accounts) {
        if (account['@type'] !== 'User') continue
        const signInName = signInNameOf(account, accountDomainId)
        if (signInName !== null) signedInTo.set(signInName, account)
        const domain = domainNamesById.get(account.domainId)
        if (domain !== undefined) accountsByAddress.set(`${account.name}@${domain}`.toLowerCase(), account)
    }

    const create: Record<string, WantedAccount> = {}
    const mailboxOfCreation = new Map<string, Omit<UserMailbox, 'accountId'>>()
    const update: Record<string, Partial<WantedAccount>> = {}
    const mailboxes: UserMailbox[] = []
    const taken = new Set<string>()
    const unplaced: string[] = []

    users.forEach((user, index) => {
        const username = user.username.toLowerCase()
        const address = user.mailAddress?.address.toLowerCase() ?? null
        const at = address?.lastIndexOf('@') ?? -1
        const domainId = address === null ? undefined : siteDomainIdsByName.get(address.slice(at + 1))
        if (address !== null && domainId === undefined) unplaced.push(address)
        const placed = address !== null && domainId !== undefined && !user.archived
            ? { address, name: address.slice(0, at), domainId }
            : null
        // An address that is the user's private email too would be sent on to itself.
        const forwards = placed && user.mailAddress?.forwardsToPrivateEmail && user.email.toLowerCase() !== address
        const mailbox = { username, address: placed?.address ?? null, forwardTo: forwards ? user.email : null }

        const atAddress = address === null ? undefined : accountsByAddress.get(address)
        const signInNameAtAddress = atAddress ? signInNameOf(atAddress, accountDomainId) : null
        const signedInToByNoUser = signInNameAtAddress !== null && !usernames.has(signInNameAtAddress)
        const account = signedInTo.get(username)
            ?? (atAddress && !taken.has(atAddress.id) && signedInToByNoUser ? atAddress : undefined)
        if (!account) {
            if (!placed || !SIGN_IN_NAME.test(username)) return
            const id = creationId(placed.address, index)
            create[id] = {
                '@type': 'User',
                name: placed.name,
                domainId: placed.domainId,
                // What the server writes there itself when the user signs in.
                description: `${user.firstname} ${user.lastname}`,
                aliases: { 0: { name: username, domainId: accountDomainId, enable: true } },
            }
            mailboxOfCreation.set(id, { ...mailbox, memberGroupIds: [] })
            return
        }
        taken.add(account.id)
        mailboxes.push({ ...mailbox, accountId: account.id, memberGroupIds: Object.keys(account.memberGroupIds ?? {}) })
        if (!placed) return
        const changes: Partial<WantedAccount> = {}
        if (account.name !== placed.name) changes.name = placed.name
        if (account.domainId !== placed.domainId) changes.domainId = placed.domainId
        const aliases = aliasesToSignInBy(account, username, accountDomainId)
        if (aliases) changes.aliases = aliases
        if (Object.keys(changes).length > 0) update[account.id] = changes
    })
    if (unplaced.length > 0) {
        logger.warn('Mail server sync keeps no mailbox for users at addresses on domains the server does not hold for '
            + `the sites: ${unplaced.join(', ')}`)
    }
    const stale = Array.from(signedInTo.values()).filter(account => !taken.has(account.id)).map(account => account.id)

    const moved = await client.set('Account', { update })
    const made = await client.set('Account', { create })
    for (const [id, created] of Object.entries(made.created)) {
        const mailbox = mailboxOfCreation.get(id)
        if (mailbox) mailboxes.push({ ...mailbox, accountId: created.id })
    }

    return {
        changes: { created: Object.keys(made.created).length, updated: moved.updated },
        mailboxes,
        stale,
        refused: [...moved.refused, ...made.refused],
    }
}
