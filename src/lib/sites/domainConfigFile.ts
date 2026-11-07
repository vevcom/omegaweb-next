import { DomainConfig } from './domainConfig'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Reading sites.json, apart from configuring DomainContext with it, so next.config.ts takes its dev
 * hosts from the same file. Relative imports only, since next.config.ts is compiled without the
 * path aliases.
 */

/** Where the domains are declared: sites.json at the app's root, or the file SITES_CONFIG names. */
export function domainConfigFile(): string {
    return process.env.SITES_CONFIG ?? resolve(process.cwd(), 'sites.json')
}

/**
 * The config in `file`, or an empty one when there is no such file, which is how the build runs.
 * Everything else requires Omega's main domain, see loadDomainConfig.
 */
export function readDomainConfig(file = domainConfigFile()): DomainConfig {
    if (!existsSync(file)) return DomainConfig.parse({})
    return DomainConfig.parse(JSON.parse(readFileSync(file, 'utf8')))
}
