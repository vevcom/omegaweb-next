import { ServiceError } from '@/services/error'
import { SiteContext } from '@/lib/sites/context'
import { loadDomainConfig } from '@/lib/sites/loadDomainConfig'


export const MailListTypeArray = ['alias', 'mailingList', 'group', 'user', 'mailaddressExternal'] as const

/**
 * The domains mail is ours on: Omega's mail domain, EMAIL_DOMAIN, and every domain of the sites in
 * sites.json. Aliases and senders are on one of them, external addresses on none. Postfix receives
 * mail for every domain an alias is on, see containers/postfix.
 */
export function validMailAddressDomains(): string[] {
    if (!process.env.EMAIL_DOMAIN) {
        throw new ServiceError('INVALID CONFIGURATION', 'The env var EMAIL_DOMAIN must be set')
    }
    loadDomainConfig()
    const domains = [process.env.EMAIL_DOMAIN, ...SiteContext.hostNames()]
        .map(domain => domain.toLowerCase())
    return domains.filter((domain, index) => domains.indexOf(domain) === index)
}

/** Whether an address is on one of our mail domains, whatever its case. */
export function isOwnMailAddress(address: string): boolean {
    const domain = address.split('@').at(-1)?.trim().toLowerCase()
    return domain !== undefined && validMailAddressDomains().includes(domain)
}
