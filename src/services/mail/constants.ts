import { DomainContext } from '@/lib/sites/context'
import { loadDomainConfig } from '@/lib/sites/loadDomainConfig'


export const MailListTypeArray = ['alias', 'mailingList', 'group', 'user', 'mailaddressExternal'] as const

/**
 * The domains mail is ours on: every domain of the sites in sites.json, Omega's main domain among
 * them. Aliases and senders are on one of them, external addresses on none. The mail server has to
 * hold each of them for its aliases to work, which the infrastructure's plan for it sees to: the
 * sync creates no domain, see lib/mailServerSync/sync.ts.
 */
export function validMailAddressDomains(): string[] {
    loadDomainConfig()
    return DomainContext.hostNames()
}

/** Whether an address is on one of our mail domains, whatever its case. */
export function isOwnMailAddress(address: string): boolean {
    const domain = address.split('@').at(-1)?.trim().toLowerCase()
    return domain !== undefined && validMailAddressDomains().includes(domain)
}
