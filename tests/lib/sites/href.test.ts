import { resolveHref } from '@/lib/sites/href'
import { describe, expect, test } from '@jest/globals'
import type { SiteContext } from '@/lib/sites/href'

const mainOrigins = { OMEGAWEB: 'https://omega.ntnu.no', CAREERS: 'https://contactor.no', REVUE: null }
const onOmega: SiteContext = { site: 'OMEGAWEB', mainOrigins }
const onCareers: SiteContext = { site: 'CAREERS', mainOrigins }
const noDomains: SiteContext = { site: 'OMEGAWEB', mainOrigins: { OMEGAWEB: null, CAREERS: null, REVUE: null } }

describe('resolveHref', () => {
    test('a page of the visitor\'s own site is site-relative', () => {
        expect(resolveHref('/career/job-ads', onCareers)).toBe('/job-ads')
        expect(resolveHref('/career', onCareers)).toBe('/')
        expect(resolveHref('/career?event-tags=BedPres', onCareers)).toBe('/?event-tags=BedPres')
        expect(resolveHref('/events/x-1', onOmega)).toBe('/events/x-1')
    })

    test('from an Omega domain another site sits under its base path', () => {
        expect(resolveHref('/career/job-ads', onOmega)).toBe('/career/job-ads')
        expect(resolveHref('/revue', onOmega)).toBe('/revue')
    })

    test('from another site\'s domain a page is reached by its site\'s main domain', () => {
        expect(resolveHref('/committees/x', onCareers)).toBe('https://omega.ntnu.no/committees/x')
        expect(resolveHref('/', onCareers)).toBe('https://omega.ntnu.no/')
    })

    test('a site without domains is reached by Omega\'s main domain with the base path', () => {
        expect(resolveHref('/revue/login', onCareers)).toBe('https://omega.ntnu.no/revue/login')
    })

    test('viaDomain goes by the main domain even where a path would do', () => {
        expect(resolveHref('/career', onOmega, { viaDomain: true })).toBe('https://contactor.no/')
        expect(resolveHref('/', onCareers, { viaDomain: true })).toBe('https://omega.ntnu.no/')
        expect(resolveHref('/revue', onOmega, { viaDomain: true })).toBe('/revue')
    })

    test('without any domains every link is the app path, as before', () => {
        expect(resolveHref('/career/job-ads', noDomains)).toBe('/career/job-ads')
        expect(resolveHref('/career', noDomains, { viaDomain: true })).toBe('/career')
    })

    test('leaves anything but an app path alone', () => {
        const external = 'https://www.facebook.com/ContactorNTNU/'
        expect(resolveHref(external, onCareers)).toBe(external)
        expect(resolveHref('mailto:post@contactor.no', onCareers)).toBe('mailto:post@contactor.no')
        expect(resolveHref('#top', onCareers)).toBe('#top')
    })
})
