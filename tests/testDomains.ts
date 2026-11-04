import { DomainConfig } from '@/lib/sites/domainConfig'

/**
 * The domains tests run with, whatever sites.json at the repo root says: Omega's production domain,
 * which the test addresses are on, and nothing else, so the other sites go by base paths.
 */
export const testDomainConfig = DomainConfig.parse({
    'omega.ntnu.no': { site: 'OMEGAWEB', main: true },
})
