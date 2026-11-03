import { parseSiteDomains, readSiteDomains } from '@/lib/sites/domains'
import { describe, expect, test } from '@jest/globals'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const config = {
    'omega.ntnu.no': { site: 'OMEGAWEB', main: true },
    'contactor.no': { site: 'CAREERS', main: true },
    'www.contactor.no': { site: 'CAREERS' },
    'localhost:3000': { site: 'OMEGAWEB', protocol: 'http' },
}

describe('siteDomains', () => {
    test('reads the hosts of each site, with https unless told otherwise', () => {
        const domains = parseSiteDomains(config)
        expect(domains.originsOfSite('CAREERS')).toEqual(['https://contactor.no', 'https://www.contactor.no'])
        expect(domains.originsOfSite('OMEGAWEB')).toEqual(['https://omega.ntnu.no', 'http://localhost:3000'])
        expect(domains.originsOfSite('REVUE')).toEqual([])
    })

    test('finds the site of a host, whatever its case, and none for an unknown host', () => {
        const domains = parseSiteDomains(config)
        expect(domains.siteOfHost('Contactor.no')).toBe('CAREERS')
        expect(domains.siteOfHost('localhost:3000')).toBe('OMEGAWEB')
        expect(domains.siteOfHost('evil.example')).toBeNull()
    })

    test('knows each site\'s main origin, null without domains', () => {
        const domains = parseSiteDomains(config)
        expect(domains.mainOrigins).toEqual({
            OMEGAWEB: 'https://omega.ntnu.no',
            CAREERS: 'https://contactor.no',
            REVUE: null,
        })
        expect(domains.mainOriginOfSite('REVUE')).toBeNull()
    })

    test('rejects a site with two main domains, and one with domains but no main', () => {
        expect(() => parseSiteDomains({
            'contactor.no': { site: 'CAREERS', main: true },
            'www.contactor.no': { site: 'CAREERS', main: true },
        })).toThrow(/CAREERS has 2 domains marked main/)
        expect(() => parseSiteDomains({
            'contactor.no': { site: 'CAREERS' },
        })).toThrow(/CAREERS has 0 domains marked main/)
    })

    test('rejects an unknown site and a host that is not a host', () => {
        expect(() => parseSiteDomains({ 'contactor.no': { site: 'SHOP', main: true } })).toThrow()
        expect(() => parseSiteDomains({ 'https://contactor.no': { site: 'CAREERS', main: true } })).toThrow()
    })

    test('reads a file, and treats a missing file as no domains', () => {
        const dir = mkdtempSync(join(tmpdir(), 'site-domains-'))
        const file = join(dir, 'sites.json')
        writeFileSync(file, JSON.stringify(config))
        expect(readSiteDomains(file).siteOfHost('contactor.no')).toBe('CAREERS')
        const none = readSiteDomains(join(dir, 'missing.json'))
        expect(none.domains).toEqual([])
        expect(none.siteOfHost('contactor.no')).toBeNull()
    })
})
