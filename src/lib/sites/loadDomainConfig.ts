import '@pn-server-only'
import { DomainConfig } from './domainConfig'
import { DomainContext } from './context'
import { domainConfigFile, readDomainConfig } from './domainConfigFile'
import { Site } from './site'
import { isBuildPhase } from '@/lib/isBuildPhase'

/**
 * Configures DomainContext with sites.json at the app's root, or the file SITES_CONFIG names, once.
 * The server calls it at start (instrumentation.ts) and on every request (proxy.ts), the worker and
 * the seeder at start; after that nothing has to think about where the domains come from.
 */
export function loadDomainConfig(): void {
    if (DomainContext.isConfigured()) return
    const file = domainConfigFile()
    DomainContext.configure(isBuildPhase() ? DomainConfig.parse({}) : requireOmegaMainDomain(readDomainConfig(file), file))
}

/**
 * The config, when it gives Omega's site a main domain: links from outside the app and Omega's own
 * mail addresses go by it, so nothing runs without one. The build alone runs without the file.
 */
export function requireOmegaMainDomain(config: DomainConfig, file: string): DomainConfig {
    if (!config.mainOriginOfSite(Site.root)) {
        throw new Error(`${file} gives Omega's site (${Site.root.name}) no main domain. `
            + 'Copy sites.example.json to sites.json for development, see README.md.')
    }
    return config
}
