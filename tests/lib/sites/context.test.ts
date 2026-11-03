import { DomainConfig } from '@/lib/sites/domainConfig'
import { SiteContext } from '@/lib/sites/context'
import { Site } from '@/lib/sites/site'
import { beforeEach, describe, expect, test } from '@jest/globals'
import type { SiteContextData } from '@/lib/sites/context'

const withDomains = DomainConfig.parse({
    'omega.ntnu.no': { site: 'OMEGAWEB', main: true },
    'contactor.no': { site: 'CAREERS', main: true },
    'contactor.com': { site: 'CAREERS' },
})
const withoutDomains = DomainConfig.parse({})

describe('SiteContext', () => {
    beforeEach(() => SiteContext.configure(withDomains))

    test('on a site\'s own domain the path is the site\'s, with the base path put back', () => {
        const context = SiteContext.fromBrowser('contactor.no', '/job-ads')
        expect(context.path).toBe('/career/job-ads')
        expect(context.siteDomain()).toMatchObject({ host: 'contactor.no', site: 'CAREERS', main: true })
        expect(context.hostSite()).toBe(Site.CAREERS)
        expect(context.site()).toBe(Site.CAREERS)
        expect(context.servesBasePaths()).toBe(false)
        expect(context.browserPath()).toBe('/job-ads')
        expect(SiteContext.fromBrowser('contactor.no', '/').path).toBe('/career')
        expect(SiteContext.fromBrowser('contactor.no', '/?event-tags=BedPres').path).toBe('/career?event-tags=BedPres')
    })

    test('on an Omega domain the path is as sent, and the page\'s site comes from it', () => {
        const context = SiteContext.fromBrowser('omega.ntnu.no', '/career/job-ads')
        expect(context.path).toBe('/career/job-ads')
        expect(context.hostSite()).toBe(Site.OMEGAWEB)
        expect(context.site()).toBe(Site.CAREERS)
        expect(context.servesBasePaths()).toBe(true)
        expect(context.browserPath()).toBe('/career/job-ads')
        expect(SiteContext.fromBrowser('omega.ntnu.no', '/events').site()).toBe(Site.OMEGAWEB)
    })

    test('the same page on contactor.no and on omega.ntnu.no/career are different contexts', () => {
        const onCareerDomain = SiteContext.fromBrowser('contactor.no', '/job-ads')
        const onOmegaDomain = SiteContext.fromBrowser('omega.ntnu.no', '/career/job-ads')
        expect(onCareerDomain.path).toBe(onOmegaDomain.path)
        expect(onCareerDomain.site()).toBe(onOmegaDomain.site())
        expect(onCareerDomain.hostSite()).not.toBe(onOmegaDomain.hostSite())
        expect(onCareerDomain.browserPath()).not.toBe(onOmegaDomain.browserPath())
    })

    test('an unconfigured host serves everything like an Omega domain', () => {
        SiteContext.configure(withoutDomains)
        const context = SiteContext.fromBrowser('localhost:3000', '/revue/login')
        expect(context.siteDomain()).toBeNull()
        expect(context.hostSite()).toBe(Site.OMEGAWEB)
        expect(context.site()).toBe(Site.REVUE)
    })

    test('holds nothing but the domain and the path, and survives the trip to the browser', () => {
        const context = SiteContext.fromAppPath('contactor.no', '/career/job-ads')
        expect(context.toData()).toEqual({ domain: 'contactor.no', path: '/career/job-ads' })
        const data = JSON.parse(JSON.stringify(context.toData())) as SiteContextData
        expect(SiteContext.fromData(data).site()).toBe(Site.CAREERS)
        expect(context.withPath('/career/about').browserPath()).toBe('/about')
    })

    test('makes a public url of a page by the main domain serving it, and refuses without Omega\'s', () => {
        expect(SiteContext.publicUrl(Site.CAREERS, '/career/job-ads')).toBe('https://contactor.no/job-ads')
        expect(SiteContext.publicUrl(Site.REVUE, '/revue')).toBe('https://omega.ntnu.no/revue')
        SiteContext.configure(withoutDomains)
        expect(() => SiteContext.publicUrl(Site.REVUE, '/revue')).toThrow()
    })

    test('puts a site\'s mail on its main domain, or Omega\'s without one, and refuses without Omega\'s', () => {
        expect(SiteContext.mailDomainOf(Site.CAREERS)).toBe('contactor.no')
        expect(SiteContext.mailDomainOf(Site.REVUE)).toBe('omega.ntnu.no')
        expect(SiteContext.mailDomainOf(Site.root)).toBe('omega.ntnu.no')
        SiteContext.configure(DomainConfig.parse({ 'localhost:3000': { site: 'OMEGAWEB', main: true, protocol: 'http' } }))
        expect(SiteContext.mailDomainOf(Site.CAREERS)).toBe('localhost')
        SiteContext.configure(withoutDomains)
        expect(() => SiteContext.mailDomainOf(Site.root)).toThrow()
    })

    describe('resolveHref', () => {
        const onOmega = SiteContext.fromAppPath('omega.ntnu.no', '/')
        const onCareers = SiteContext.fromAppPath('contactor.no', '/career')
        const onCareersOther = SiteContext.fromAppPath('contactor.com', '/career')

        test('a page of the host\'s own site is site-relative', () => {
            expect(onCareers.resolveHref('/career/job-ads')).toBe('/job-ads')
            expect(onCareers.resolveHref('/career')).toBe('/')
            expect(onCareers.resolveHref('/career?event-tags=BedPres')).toBe('/?event-tags=BedPres')
            expect(onOmega.resolveHref('/events/x-1')).toBe('/events/x-1')
        })

        test('from an Omega domain another site sits under its base path', () => {
            expect(onOmega.resolveHref('/career/job-ads')).toBe('/career/job-ads')
            expect(onOmega.resolveHref('/revue')).toBe('/revue')
        })

        test('a site\'s other domains keep the visitor on them', () => {
            expect(onCareersOther.resolveHref('/career/job-ads')).toBe('/job-ads')
            expect(onCareersOther.resolveHref('/committees/x')).toBe('https://omega.ntnu.no/committees/x')
        })

        test('from another site\'s domain a page is reached by its site\'s main domain', () => {
            expect(onCareers.resolveHref('/committees/x')).toBe('https://omega.ntnu.no/committees/x')
            expect(onCareers.resolveHref('/')).toBe('https://omega.ntnu.no/')
        })

        test('a site without domains is reached by Omega\'s main domain with the base path', () => {
            expect(onCareers.resolveHref('/revue/login')).toBe('https://omega.ntnu.no/revue/login')
        })

        test('toMainDomainServingSite goes by the main domain serving the page, even from a domain that does', () => {
            const toMain = { toMainDomainServingSite: true }
            expect(onOmega.resolveHref('/career', toMain)).toBe('https://contactor.no/')
            expect(onCareers.resolveHref('/', toMain)).toBe('https://omega.ntnu.no/')
            expect(onOmega.resolveHref('/revue', toMain)).toBe('https://omega.ntnu.no/revue')
            expect(onCareersOther.resolveHref('/career/job-ads', toMain)).toBe('https://contactor.no/job-ads')
        })

        test('without any domains every link is the app path, as before', () => {
            SiteContext.configure(withoutDomains)
            const onLocalhost = SiteContext.fromAppPath('localhost:3000', '/')
            expect(onLocalhost.resolveHref('/career/job-ads')).toBe('/career/job-ads')
            expect(onLocalhost.resolveHref('/career', { toMainDomainServingSite: true })).toBe('/career')
        })

        test('leaves anything but an app path alone', () => {
            const external = 'https://www.facebook.com/ContactorNTNU/'
            expect(onCareers.resolveHref(external)).toBe(external)
            expect(onCareers.resolveHref('mailto:post@contactor.no')).toBe('mailto:post@contactor.no')
            expect(onCareers.resolveHref('#top')).toBe('#top')
        })

        test('keeps the app-wide paths on the domain the visitor is on', () => {
            expect(onCareers.resolveHref('/api/health')).toBe('/api/health')
            expect(onCareers.resolveHref('/store/images/cover.webp')).toBe('/store/images/cover.webp')
        })
    })
})
