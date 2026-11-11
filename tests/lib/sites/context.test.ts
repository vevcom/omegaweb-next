import { DomainConfig } from '@/lib/sites/domainConfig'
import { DomainContext } from '@/lib/sites/context'
import { Site } from '@/lib/sites/site'
import { appHref, externalHref } from '@/lib/sites/href'
import { beforeEach, describe, expect, test } from '@jest/globals'
import type { DomainContextData } from '@/lib/sites/context'

const withDomains = DomainConfig.parse({
    'omega.ntnu.no': { site: 'OMEGAWEB', main: true },
    'contactor.no': { site: 'CAREERS', main: true },
    'contactor.com': { site: 'CAREERS' },
})
const withoutDomains = DomainConfig.parse({})
const withAuthDomain = DomainConfig.parse({
    'omega.ntnu.no': { site: 'OMEGAWEB', main: true },
    'contactor.no': { site: 'CAREERS', main: true },
    'login.omega.ntnu.no': { auth: true },
})

describe('DomainContext', () => {
    beforeEach(() => DomainContext.configure(withDomains))

    test('on a site\'s own domain the path is the site\'s, with the base path put back', () => {
        const context = DomainContext.fromBrowser('contactor.no', '/job-ads')
        expect(context.path).toBe('/career/job-ads')
        expect(context.siteDomain()).toMatchObject({ host: 'contactor.no', site: 'CAREERS', main: true })
        expect(context.hostSite()).toBe(Site.CAREERS)
        expect(context.site()).toBe(Site.CAREERS)
        expect(context.servesBasePaths()).toBe(false)
        expect(context.browserPath()).toBe('/job-ads')
        expect(DomainContext.fromBrowser('contactor.no', '/').path).toBe('/career')
        expect(DomainContext.fromBrowser('contactor.no', '/?event-tags=BedPres').path).toBe('/career?event-tags=BedPres')
    })

    test('on an Omega domain the path is as sent, and the page\'s site comes from it', () => {
        const context = DomainContext.fromBrowser('omega.ntnu.no', '/career/job-ads')
        expect(context.path).toBe('/career/job-ads')
        expect(context.hostSite()).toBe(Site.OMEGAWEB)
        expect(context.site()).toBe(Site.CAREERS)
        expect(context.servesBasePaths()).toBe(true)
        expect(context.browserPath()).toBe('/career/job-ads')
        expect(DomainContext.fromBrowser('omega.ntnu.no', '/events').site()).toBe(Site.OMEGAWEB)
        expect(DomainContext.fromBrowser('omega.ntnu.no', '/').path).toBe('/')
        expect(DomainContext.fromBrowser('omega.ntnu.no', '/?a=1').path).toBe('/?a=1')
    })

    test('the same page on contactor.no and on omega.ntnu.no/career are different contexts', () => {
        const onCareerDomain = DomainContext.fromBrowser('contactor.no', '/job-ads')
        const onOmegaDomain = DomainContext.fromBrowser('omega.ntnu.no', '/career/job-ads')
        expect(onCareerDomain.path).toBe(onOmegaDomain.path)
        expect(onCareerDomain.site()).toBe(onOmegaDomain.site())
        expect(onCareerDomain.hostSite()).not.toBe(onOmegaDomain.hostSite())
        expect(onCareerDomain.browserPath()).not.toBe(onOmegaDomain.browserPath())
    })

    test('an unconfigured host serves everything like an Omega domain', () => {
        DomainContext.configure(withoutDomains)
        const context = DomainContext.fromBrowser('localhost:3000', '/revue/login')
        expect(context.siteDomain()).toBeNull()
        expect(context.hostSite()).toBe(Site.OMEGAWEB)
        expect(context.site()).toBe(Site.REVUE)
    })

    test('holds nothing but the domain and the path, and survives the trip to the browser', () => {
        const context = DomainContext.fromAppPath('contactor.no', '/career/job-ads')
        expect(context.toData()).toEqual({ domain: 'contactor.no', path: '/career/job-ads' })
        const data = JSON.parse(JSON.stringify(context.toData())) as DomainContextData
        expect(DomainContext.fromData(data).site()).toBe(Site.CAREERS)
        expect(context.withPath(appHref('/career/about')).browserPath()).toBe('/about')
    })

    test('makes a public url of a page by the main domain serving it, and refuses without Omega\'s', () => {
        expect(DomainContext.publicUrl(Site.CAREERS, appHref('/career/job-ads'))).toBe('https://contactor.no/job-ads')
        expect(DomainContext.publicUrl(Site.REVUE, appHref('/revue'))).toBe('https://omega.ntnu.no/revue')
        DomainContext.configure(withoutDomains)
        expect(() => DomainContext.publicUrl(Site.REVUE, appHref('/revue'))).toThrow()
    })

    test('makes the url of an app path on the auth domain, under the site\'s base path, and refuses without one', () => {
        expect(DomainContext.authDomainUrl(appHref('/career/verify-email?token=x')))
            .toBe('https://omega.ntnu.no/career/verify-email?token=x')
        DomainContext.configure(withAuthDomain)
        expect(DomainContext.authDomainUrl(appHref('/career/verify-email?token=x')))
            .toBe('https://login.omega.ntnu.no/career/verify-email?token=x')
        expect(DomainContext.authDomainUrl(appHref('/reset-password-form?token=x')))
            .toBe('https://login.omega.ntnu.no/reset-password-form?token=x')
        expect(DomainContext.authOrigin()).toBe('https://login.omega.ntnu.no')
        DomainContext.configure(withoutDomains)
        expect(() => DomainContext.authOrigin()).toThrow()
        expect(() => DomainContext.authDomainUrl(appHref('/login'))).toThrow()
    })

    test('a public url never tells an auth page from its path', () => {
        DomainContext.configure(withAuthDomain)
        expect(DomainContext.publicUrl(Site.CAREERS, appHref('/career/verify-email?token=x')))
            .toBe('https://contactor.no/verify-email?token=x')
        expect(DomainContext.publicUrl(Site.CAREERS, appHref('/career/logout'))).toBe('https://contactor.no/logout')
    })

    describe('urlOnServingDomain', () => {
        const login = '/career/login?callbackUrl=%2Fcareer%2Fjob-ads&token=x'

        test('a page served on the auth domain goes there from any other domain, with its path and query', () => {
            expect(DomainContext.fromBrowser('contactor.no', '/login?callbackUrl=%2Fcareer%2Fjob-ads&token=x')
                .urlOnServingDomain('auth-domain')).toBe(`https://omega.ntnu.no${login}`)
            expect(DomainContext.fromAppPath('contactor.com', login).urlOnServingDomain('auth-domain'))
                .toBe(`https://omega.ntnu.no${login}`)
            expect(DomainContext.fromAppPath('omega.ntnu.no', login).urlOnServingDomain('auth-domain')).toBeNull()
            DomainContext.configure(withAuthDomain)
            expect(DomainContext.fromAppPath('contactor.no', login).urlOnServingDomain('auth-domain'))
                .toBe(`https://login.omega.ntnu.no${login}`)
            expect(DomainContext.fromAppPath('omega.ntnu.no', '/register').urlOnServingDomain('auth-domain'))
                .toBe('https://login.omega.ntnu.no/register')
            expect(DomainContext.fromAppPath('login.omega.ntnu.no', login).urlOnServingDomain('auth-domain')).toBeNull()
        })

        test('any other page is served where it is asked for, except on a domain set apart to sign in', () => {
            expect(DomainContext.fromAppPath('contactor.no', '/career/job-ads').urlOnServingDomain()).toBeNull()
            expect(DomainContext.fromAppPath('omega.ntnu.no', '/career/job-ads').urlOnServingDomain()).toBeNull()
            expect(DomainContext.fromAppPath('omega.ntnu.no', '/logout').urlOnServingDomain()).toBeNull()
            DomainContext.configure(withAuthDomain)
            expect(DomainContext.fromAppPath('omega.ntnu.no', '/events').urlOnServingDomain()).toBeNull()
            expect(DomainContext.fromAppPath('login.omega.ntnu.no', '/career/job-ads?page=2').urlOnServingDomain())
                .toBe('https://contactor.no/job-ads?page=2')
            expect(DomainContext.fromAppPath('login.omega.ntnu.no', '/career/logout').urlOnServingDomain())
                .toBe('https://contactor.no/logout')
            expect(DomainContext.fromAppPath('login.omega.ntnu.no', '/events?a=1').urlOnServingDomain())
                .toBe('https://omega.ntnu.no/events?a=1')
            expect(DomainContext.fromAppPath('login.omega.ntnu.no', '/revue').urlOnServingDomain())
                .toBe('https://omega.ntnu.no/revue')
        })

        test('without an auth domain every page is served where it is asked for', () => {
            DomainContext.configure(withoutDomains)
            const onLocalhost = DomainContext.fromAppPath('localhost:3000', '/career/login')
            expect(onLocalhost.urlOnServingDomain('auth-domain')).toBeNull()
            expect(onLocalhost.urlOnServingDomain()).toBeNull()
        })
    })

    test('the dedicated auth domain is no site\'s, serves base paths and no site\'s pages', () => {
        DomainContext.configure(withAuthDomain)
        const context = DomainContext.fromBrowser('login.omega.ntnu.no', '/career/login')
        expect(context.siteDomain()).toBeNull()
        expect(context.isDedicatedAuthDomain()).toBe(true)
        expect(context.isAuthDomain()).toBe(true)
        expect(context.hostSite()).toBe(Site.OMEGAWEB)
        expect(context.site()).toBe(Site.CAREERS)
        expect(context.servesBasePaths()).toBe(true)
        expect(context.serves(Site.CAREERS)).toBe(false)
        expect(context.serves(Site.OMEGAWEB)).toBe(false)
        expect(DomainContext.fromBrowser('omega.ntnu.no', '/').isAuthDomain()).toBe(false)
        expect(DomainContext.fromBrowser('omega.ntnu.no', '/').isDedicatedAuthDomain()).toBe(false)
    })

    test('without a dedicated auth domain, Omega\'s main domain signs users in', () => {
        expect(DomainContext.fromBrowser('omega.ntnu.no', '/').isAuthDomain()).toBe(true)
        expect(DomainContext.fromBrowser('omega.ntnu.no', '/').isDedicatedAuthDomain()).toBe(false)
        expect(DomainContext.fromBrowser('omega.ntnu.no', '/').serves(Site.CAREERS)).toBe(true)
        expect(DomainContext.fromBrowser('contactor.no', '/').isAuthDomain()).toBe(false)
        DomainContext.configure(withoutDomains)
        expect(DomainContext.fromBrowser('localhost:3000', '/').isAuthDomain()).toBe(false)
    })

    test('puts a site\'s mail on its main domain, or Omega\'s without one, and refuses without Omega\'s', () => {
        expect(DomainContext.mailDomainOf(Site.CAREERS)).toBe('contactor.no')
        expect(DomainContext.mailDomainOf(Site.REVUE)).toBe('omega.ntnu.no')
        expect(DomainContext.mailDomainOf(Site.root)).toBe('omega.ntnu.no')
        DomainContext.configure(DomainConfig.parse({ 'localhost:3000': { site: 'OMEGAWEB', main: true, protocol: 'http' } }))
        expect(DomainContext.mailDomainOf(Site.CAREERS)).toBe('localhost')
        DomainContext.configure(withoutDomains)
        expect(() => DomainContext.mailDomainOf(Site.root)).toThrow()
    })

    describe('resolveHref', () => {
        const onOmega = DomainContext.fromAppPath('omega.ntnu.no', '/')
        const onCareers = DomainContext.fromAppPath('contactor.no', '/career')
        const onCareersOther = DomainContext.fromAppPath('contactor.com', '/career')

        test('a page of the host\'s own site is site-relative', () => {
            expect(onCareers.resolveHref(appHref('/career/job-ads'))).toBe('/job-ads')
            expect(onCareers.resolveHref(appHref('/career'))).toBe('/')
            expect(onCareers.resolveHref(appHref('/career?event-tags=BedPres'))).toBe('/?event-tags=BedPres')
            expect(onOmega.resolveHref(appHref('/events/x-1'))).toBe('/events/x-1')
        })

        test('from an Omega domain another site sits under its base path', () => {
            expect(onOmega.resolveHref(appHref('/career/job-ads'))).toBe('/career/job-ads')
            expect(onOmega.resolveHref(appHref('/revue'))).toBe('/revue')
        })

        test('a path never becomes another host once its base path is taken off', () => {
            const paths = [
                '/career//evil.example', '/career/\\evil.example', '/career/\t/evil.example', '/career///evil.example/x',
            ]
            for (const path of paths) {
                const resolved = onCareers.resolveHref(appHref(path))
                expect(new URL(resolved, 'https://contactor.no').origin).toBe('https://contactor.no')
            }
            expect(onCareers.resolveHref(appHref('/career//evil.example'))).toBe('/evil.example')
        })

        test('a site\'s other domains keep the visitor on them', () => {
            expect(onCareersOther.resolveHref(appHref('/career/job-ads'))).toBe('/job-ads')
            expect(onCareersOther.resolveHref(appHref('/committees/x'))).toBe('https://omega.ntnu.no/committees/x')
        })

        test('from another site\'s domain a page is reached by its site\'s main domain', () => {
            expect(onCareers.resolveHref(appHref('/committees/x'))).toBe('https://omega.ntnu.no/committees/x')
            expect(onCareers.resolveHref(appHref('/'))).toBe('https://omega.ntnu.no/')
        })

        test('a site without domains is reached by Omega\'s main domain with the base path', () => {
            expect(onCareers.resolveHref(appHref('/revue/login'))).toBe('https://omega.ntnu.no/revue/login')
        })

        test('toMainDomainServingSite goes by the main domain serving the page, even from a domain that does', () => {
            const toMain = { toMainDomainServingSite: true }
            expect(onOmega.resolveHref(appHref('/career'), toMain)).toBe('https://contactor.no/')
            expect(onCareers.resolveHref(appHref('/'), toMain)).toBe('https://omega.ntnu.no/')
            expect(onOmega.resolveHref(appHref('/revue'), toMain)).toBe('https://omega.ntnu.no/revue')
            expect(onCareersOther.resolveHref(appHref('/career/job-ads'), toMain)).toBe('https://contactor.no/job-ads')
        })

        test('a link that says its page is served on the auth domain stays there or goes straight to it', () => {
            const servedOnAuth = { servedOn: 'auth-domain' } as const
            const register = appHref('/career/register?callbackUrl=%2Fcareer')
            // Without a domain set apart, Omega's main domain signs users in.
            expect(onOmega.resolveHref(register, servedOnAuth)).toBe(register)
            expect(onCareers.resolveHref(register, servedOnAuth)).toBe(`https://omega.ntnu.no${register}`)

            DomainContext.configure(withAuthDomain)
            const onAuth = DomainContext.fromAppPath('login.omega.ntnu.no', '/career/login')
            expect(onAuth.resolveHref(register, servedOnAuth)).toBe(register)
            expect(onAuth.resolveHref(register)).toBe('https://contactor.no/register?callbackUrl=%2Fcareer')
            expect(onCareers.resolveHref(register, servedOnAuth)).toBe(`https://login.omega.ntnu.no${register}`)
            expect(onOmega.resolveHref(appHref('/register'), servedOnAuth)).toBe('https://login.omega.ntnu.no/register')
            expect(onAuth.resolveHref(appHref('/api/sso/start'), servedOnAuth)).toBe('/api/sso/start')

            DomainContext.configure(withoutDomains)
            expect(DomainContext.fromAppPath('localhost:3000', '/').resolveHref(register, servedOnAuth)).toBe(register)
        })

        test('without any domains every link is the app path, as before', () => {
            DomainContext.configure(withoutDomains)
            const onLocalhost = DomainContext.fromAppPath('localhost:3000', '/')
            expect(onLocalhost.resolveHref(appHref('/career/job-ads'))).toBe('/career/job-ads')
            expect(onLocalhost.resolveHref(appHref('/career'), { toMainDomainServingSite: true })).toBe('/career')
        })

        test('leaves anything but an app path alone', () => {
            const external = externalHref('https://www.facebook.com/ContactorNTNU/')
            expect(onCareers.resolveHref(external)).toBe(external)
            expect(onCareers.resolveHref(externalHref('mailto:post@contactor.no'))).toBe('mailto:post@contactor.no')
            expect(onCareers.resolveHref(externalHref('#top'))).toBe('#top')
        })

        test('keeps the app-wide paths on the domain the visitor is on', () => {
            expect(onCareers.resolveHref(appHref('/api/health'))).toBe('/api/health')
            expect(onCareers.resolveHref(appHref('/store/images/cover.webp'))).toBe('/store/images/cover.webp')
        })

        test('an auth page resolves like any page of its site, never to the auth domain by its path', () => {
            const login = appHref('/career/login?callbackUrl=%2Fcareer')
            expect(onCareers.resolveHref(login)).toBe('/login?callbackUrl=%2Fcareer')
            expect(onOmega.resolveHref(login)).toBe('/career/login?callbackUrl=%2Fcareer')
            expect(onOmega.resolveHref(appHref('/register'))).toBe('/register')
            DomainContext.configure(withAuthDomain)
            const onAuth = DomainContext.fromAppPath('login.omega.ntnu.no', '/career/login')
            expect(onCareers.resolveHref(login)).toBe('/login?callbackUrl=%2Fcareer')
            expect(onOmega.resolveHref(appHref('/register'))).toBe('/register')
            // From the domain set apart to sign in it leaves like every page, and the page sends it back.
            expect(onAuth.resolveHref(login)).toBe('https://contactor.no/login?callbackUrl=%2Fcareer')
            expect(onAuth.resolveHref(appHref('/register'))).toBe('https://omega.ntnu.no/register')
            expect(onCareers.resolveHref(appHref('/career/logout'))).toBe('/logout')
            expect(onOmega.resolveHref(appHref('/logout'))).toBe('/logout')
        })

        test('from the dedicated auth domain every other page leaves for the domain serving it', () => {
            DomainContext.configure(withAuthDomain)
            const onAuth = DomainContext.fromAppPath('login.omega.ntnu.no', '/career/login')
            expect(onAuth.resolveHref(appHref('/career/job-ads'))).toBe('https://contactor.no/job-ads')
            expect(onAuth.resolveHref(appHref('/career/logout'))).toBe('https://contactor.no/logout')
            expect(onAuth.resolveHref(appHref('/'))).toBe('https://omega.ntnu.no/')
            expect(onAuth.resolveHref(appHref('/revue'))).toBe('https://omega.ntnu.no/revue')
            expect(onAuth.resolveHref(appHref('/api/auth/session'))).toBe('/api/auth/session')
        })

        test('without a dedicated auth domain the auth pages sit on Omega\'s main domain like any page of it', () => {
            DomainContext.configure(withoutDomains)
            const onLocalhost = DomainContext.fromAppPath('localhost:3000', '/')
            expect(onLocalhost.resolveHref(appHref('/career/login'))).toBe('/career/login')
        })

        test('keeps the files at the app\'s root there too, since every domain asks for them by their plain path', () => {
            expect(onCareers.resolveHref(appHref('/sw.js?cache=off'))).toBe('/sw.js?cache=off')
            expect(onCareers.resolveHref(appHref('/manifest.webmanifest'))).toBe('/manifest.webmanifest')
            expect(onCareers.resolveHref(appHref('/icon-192.png'))).toBe('/icon-192.png')
            // A page is never a file, however it is named.
            expect(onCareers.resolveHref(appHref('/about'))).toBe('https://omega.ntnu.no/about')
            expect(onCareers.resolveHref(appHref('/career/job-ads'))).toBe('/job-ads')
        })
    })
})
