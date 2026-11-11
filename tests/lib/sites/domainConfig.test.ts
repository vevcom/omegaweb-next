import { DomainConfig } from '@/lib/sites/domainConfig'
import { readDomainConfig } from '@/lib/sites/domainConfigFile'
import { requireOmegaMainDomain } from '@/lib/sites/loadDomainConfig'
import { Site } from '@/lib/sites/site'
import { describe, expect, test } from '@jest/globals'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DomainConfigData } from '@/lib/sites/domainConfig'

const json = {
    'omega.ntnu.no': { site: 'OMEGAWEB', main: true, aliases: ['www.omega.ntnu.no'] },
    'contactor.no': { site: 'CAREERS', main: true },
    'www.contactor.no': { site: 'CAREERS' },
    'localhost:3000': { site: 'OMEGAWEB', protocol: 'http' },
}

describe('DomainConfig', () => {
    test('reads the hosts of each site, with https unless told otherwise', () => {
        const config = DomainConfig.parse(json)
        expect(config.originsOfSite(Site.CAREERS)).toEqual(['https://contactor.no', 'https://www.contactor.no'])
        expect(config.originsOfSite(Site.OMEGAWEB)).toEqual(['https://omega.ntnu.no', 'http://localhost:3000'])
        expect(config.originsOfSite(Site.REVUE)).toEqual([])
    })

    test('finds the domain of a host, whatever its case, and none for an unknown host', () => {
        const config = DomainConfig.parse(json)
        expect(config.domainOfHost('Contactor.no')).toMatchObject({ host: 'contactor.no', site: 'CAREERS', main: true })
        expect(config.domainOfHost('localhost:3000')?.site).toBe('OMEGAWEB')
        expect(config.domainOfHost('evil.example')).toBeNull()
    })

    test('finds the domain a host is an alias of, whatever its case, and none for a domain or an unknown host', () => {
        const config = DomainConfig.parse(json)
        expect(config.domainOfAlias('WWW.omega.ntnu.no')?.host).toBe('omega.ntnu.no')
        expect(config.domainOfAlias('omega.ntnu.no')).toBeNull()
        expect(config.domainOfAlias('www.evil.example')).toBeNull()
        expect(config.domainOfHost('www.omega.ntnu.no')).toBeNull()
    })

    test('rejects a host listed twice in different case', () => {
        expect(() => DomainConfig.parse({
            'omega.ntnu.no': { site: 'OMEGAWEB', main: true },
            'Login.omega.ntnu.no': { auth: true },
            'login.omega.ntnu.no': { site: 'REVUE', main: true },
        })).toThrow(/listed twice/)
    })

    test('rejects an alias that is also a domain, and one listed twice', () => {
        expect(() => DomainConfig.parse({
            'contactor.no': { site: 'CAREERS', main: true, aliases: ['www.contactor.no'] },
            'www.contactor.no': { site: 'CAREERS' },
        })).toThrow(/www.contactor.no is an alias and a domain/)
        expect(() => DomainConfig.parse({
            'omega.ntnu.no': { site: 'OMEGAWEB', main: true, aliases: ['www.omega.ntnu.no'] },
            'contactor.no': { site: 'CAREERS', main: true, aliases: ['www.omega.ntnu.no'] },
        })).toThrow(/an alias twice/)
    })

    test('gives the host names without ports, once each, for the dev server', () => {
        const config = DomainConfig.parse({ ...json, 'localhost:4000': { site: 'OMEGAWEB', protocol: 'http' } })
        expect(config.hostNames()).toEqual(['omega.ntnu.no', 'contactor.no', 'www.contactor.no', 'localhost'])
    })

    test('the app runs only on a config giving Omega\'s site a main domain', () => {
        expect(requireOmegaMainDomain(DomainConfig.parse(json), 'sites.json').domains).toHaveLength(4)
        expect(() => requireOmegaMainDomain(DomainConfig.parse({}), 'sites.json')).toThrow(/no main domain/)
        expect(() => requireOmegaMainDomain(DomainConfig.parse({ 'contactor.no': { site: 'CAREERS', main: true } }), 'x'))
            .toThrow(/no main domain/)
    })

    test('knows each site\'s main origin, null without domains', () => {
        const config = DomainConfig.parse(json)
        expect(config.mainOriginOfSite(Site.OMEGAWEB)).toBe('https://omega.ntnu.no')
        expect(config.mainOriginOfSite(Site.CAREERS)).toBe('https://contactor.no')
        expect(config.mainOriginOfSite(Site.REVUE)).toBeNull()
    })

    test('rejects a site with two main domains, and one with domains but no main', () => {
        expect(() => DomainConfig.parse({
            'contactor.no': { site: 'CAREERS', main: true },
            'www.contactor.no': { site: 'CAREERS', main: true },
        })).toThrow(/CAREERS has 2 domains marked main/)
        expect(() => DomainConfig.parse({ 'contactor.no': { site: 'CAREERS' } }))
            .toThrow(/CAREERS has 0 domains marked main/)
    })

    test('rejects an unknown site and a host that is not a host', () => {
        expect(() => DomainConfig.parse({ 'contactor.no': { site: 'SHOP', main: true } })).toThrow()
        expect(() => DomainConfig.parse({ 'https://contactor.no': { site: 'CAREERS', main: true } })).toThrow()
    })

    test('survives the trip to the browser', () => {
        const config = DomainConfig.parse(json)
        const inBrowser = DomainConfig.fromJSON(JSON.parse(JSON.stringify(config)) as DomainConfigData)
        expect(inBrowser.domains).toEqual(config.domains)
        expect(inBrowser.authDomain).toBeNull()
        const withAuth = DomainConfig.parse({ ...json, 'login.omega.ntnu.no': { auth: true } })
        expect(DomainConfig.fromJSON(JSON.parse(JSON.stringify(withAuth)) as DomainConfigData).authOrigin())
            .toBe('https://login.omega.ntnu.no')
    })

    test('signs users in on the auth domain when there is one, else on Omega\'s main domain', () => {
        const config = DomainConfig.parse({ ...json, 'login.omega.ntnu.no': { auth: true } })
        expect(config.authDomain).toEqual({ host: 'login.omega.ntnu.no', origin: 'https://login.omega.ntnu.no' })
        expect(config.authOrigin()).toBe('https://login.omega.ntnu.no')
        expect(config.isAuthHost('Login.omega.ntnu.no')).toBe(true)
        expect(config.isAuthHost('omega.ntnu.no')).toBe(false)
        // The auth domain is no site's, so it is not a domain, and no mail is on it.
        expect(config.domainOfHost('login.omega.ntnu.no')).toBeNull()
        expect(config.hostNames()).toEqual(['omega.ntnu.no', 'contactor.no', 'www.contactor.no', 'localhost'])
        expect(config.allHostNames()).toContain('login.omega.ntnu.no')
        expect(config.hasDomains()).toBe(true)

        const without = DomainConfig.parse(json)
        expect(without.authDomain).toBeNull()
        expect(without.authOrigin()).toBe('https://omega.ntnu.no')
        expect(without.isAuthHost('omega.ntnu.no')).toBe(false)
        expect(DomainConfig.parse({}).authOrigin()).toBeNull()
        expect(DomainConfig.parse({}).hasDomains()).toBe(false)
        expect(DomainConfig.parse({ 'login.omega.ntnu.no': { auth: true, protocol: 'http' } }).hasDomains()).toBe(true)
    })

    test('rejects two auth domains, an auth domain of a site, and a key it does not know', () => {
        expect(() => DomainConfig.parse({
            ...json,
            'login.omega.ntnu.no': { auth: true },
            'auth.omega.ntnu.no': { auth: true },
        })).toThrow(/2 domains are marked auth/)
        expect(() => DomainConfig.parse({ 'login.omega.ntnu.no': { auth: true, site: 'OMEGAWEB' } })).toThrow()
        expect(() => DomainConfig.parse({ 'login.omega.ntnu.no': { auth: false } })).toThrow()
        expect(() => DomainConfig.parse({ 'contactor.no': { site: 'CAREERS', main: true, mian: true } })).toThrow()
    })

    test('the example for development names the three dev hosts, each a site\'s main, and the auth host', () => {
        const config = readDomainConfig(join(process.cwd(), 'sites.example.json'))
        expect(config.authOrigin()).toBe('http://auth.localhost:3000')
        expect(config.mainOriginOfSite(Site.OMEGAWEB)).toBe('http://omegaweb.localhost:3000')
        expect(config.domainOfAlias('localhost:3000')?.host).toBe('omegaweb.localhost:3000')
        expect(config.mainOriginOfSite(Site.CAREERS)).toBe('http://career.localhost:3000')
        expect(config.mainOriginOfSite(Site.REVUE)).toBe('http://revue.localhost:3000')
    })

    test('reads a file, and treats a missing file as no domains', () => {
        const dir = mkdtempSync(join(tmpdir(), 'domain-config-'))
        const file = join(dir, 'sites.json')
        writeFileSync(file, JSON.stringify(json))
        expect(readDomainConfig(file).domainOfHost('contactor.no')?.site).toBe('CAREERS')
        const none = readDomainConfig(join(dir, 'missing.json'))
        expect(none.domains).toEqual([])
        expect(none.domainOfHost('contactor.no')).toBeNull()
    })
})
