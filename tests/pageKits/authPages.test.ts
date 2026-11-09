import { authPagePaths, isAuthDomainPagePath } from '@/pageKits/auth/paths'
import { authLinks } from '@/pageKits/auth/links'
import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/config'
import { careersAuthPages } from '@/app/(careers)/career/(auth)/config'
import { appHref } from '@/lib/sites/href'
import { Site } from '@/lib/sites/site'
import { describe, expect, test } from '@jest/globals'
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const appDir = resolve(process.cwd(), 'src/app')

/** Every `(auth)` route group under src/app: the mounts of the kit. */
function authMounts(dir = appDir): string[] {
    return readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isDirectory()).flatMap(entry => {
        const path = join(dir, entry.name)
        return entry.name === '(auth)' ? [path] : authMounts(path)
    })
}

/** The folders of a mount holding a page.tsx, which are the pages the router serves under it. */
function routeFolders(mount: string): string[] {
    return readdirSync(mount, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && existsSync(join(mount, entry.name, 'page.tsx')))
        .map(entry => `/${entry.name}`)
        .sort()
}

describe('the auth page kit', () => {
    const pagePaths = Object.values(authPagePaths).map(page => page.path).sort()

    test('is mounted once per site, with exactly the pages authPagePaths names', () => {
        const mounts = authMounts()
        expect(mounts).toHaveLength(Site.all.length)
        mounts.forEach(mount => expect(routeFolders(mount)).toEqual(pagePaths))
    })

    test('links every page at its path under the site\'s root, and the login to the start of the SSO', () => {
        const onOmega = authLinks(omegaAuthPages)
        const onCareers = authLinks(careersAuthPages)
        expect(onOmega.loginForm()).toBe('/login')
        expect(onCareers.loginForm({ callbackUrl: appHref('/career/job-ads') }))
            .toBe('/career/login?callbackUrl=%2Fcareer%2Fjob-ads')
        // Signing in is the start route of the domain the visitor is on, landing on the callback or
        // the site's after-login page.
        expect(onOmega.login()).toBe('/api/sso/start?callbackUrl=%2Fusers%2Fme')
        expect(onCareers.login()).toBe('/api/sso/start?callbackUrl=%2Fcareer')
        expect(onCareers.login({ callbackUrl: appHref('/career/job-ads') }))
            .toBe('/api/sso/start?callbackUrl=%2Fcareer%2Fjob-ads')
        expect(onCareers.logout()).toBe('/career/logout')
        expect(onOmega.verifyEmail('abc')).toBe('/verify-email?token=abc')
        expect(onCareers.terms()).toBe('/career/terms')
        expect(onCareers.afterLogin()).toBe('/career')
    })

    test('tells the pages served on the auth domain by their path, on any site', () => {
        expect(isAuthDomainPagePath(appHref('/login'))).toBe(true)
        expect(isAuthDomainPagePath(appHref('/career/login?callbackUrl=%2Fcareer'))).toBe(true)
        expect(isAuthDomainPagePath(appHref('/revue/reset-password-form?token=x'))).toBe(true)
        expect(isAuthDomainPagePath(appHref('/logout'))).toBe(false)
        expect(isAuthDomainPagePath(appHref('/career/logout'))).toBe(false)
        expect(isAuthDomainPagePath(appHref('/login/x'))).toBe(false)
        expect(isAuthDomainPagePath(appHref('/terms'))).toBe(false)
        expect(isAuthDomainPagePath(appHref('/'))).toBe(false)
        expect(isAuthDomainPagePath(appHref('/career'))).toBe(false)
    })
})
