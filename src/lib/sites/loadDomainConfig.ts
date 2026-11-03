import '@pn-server-only'
import { DomainConfig } from './domainConfig'
import { SiteContext } from './context'
import { isBuildPhase } from '@/lib/isBuildPhase'
import logger from '@/lib/logger'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** The config in `file`, or an empty one when there is no such file, which is how dev without a config and CI run. */
export function readDomainConfig(file: string): DomainConfig {
    if (!existsSync(file)) return DomainConfig.parse({})
    return DomainConfig.parse(JSON.parse(readFileSync(file, 'utf8')))
}

let loaded = false

/**
 * Configures SiteContext with sites.json at the app's root, or the file SITES_CONFIG names, once.
 * The server calls it at start (instrumentation.ts) and so does the worker; after that nothing has
 * to think about where the domains come from.
 */
export function loadDomainConfig(): void {
    if (loaded) return
    const file = process.env.SITES_CONFIG ?? resolve(process.cwd(), 'sites.json')
    const config = isBuildPhase() ? DomainConfig.parse({}) : readDomainConfig(file)
    if (config.domains.length === 0 && !isBuildPhase()) {
        logger.warn(`No site domains configured (${file}): every host serves Omega's site, `
            + 'with the other sites under their base paths')
    }
    SiteContext.configure(config)
    loaded = true
}
