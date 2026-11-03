import '@pn-server-only'
import { DomainConfig } from './domainConfig'
import { SiteContext } from './context'
import { domainConfigFile, readDomainConfig } from './domainConfigFile'
import { isBuildPhase } from '@/lib/isBuildPhase'
import logger from '@/lib/logger'

/**
 * Configures SiteContext with sites.json at the app's root, or the file SITES_CONFIG names, once.
 * The server calls it at start (instrumentation.ts) and on every request (proxy.ts), the worker at
 * start; after that nothing has to think about where the domains come from.
 */
export function loadDomainConfig(): void {
    if (SiteContext.isConfigured()) return
    const file = domainConfigFile()
    const config = isBuildPhase() ? DomainConfig.parse({}) : readDomainConfig(file)
    if (config.domains.length === 0 && !isBuildPhase()) {
        logger.warn(`No site domains configured (${file}): every host serves Omega's site, `
            + 'with the other sites under their base paths')
    }
    SiteContext.configure(config)
}
