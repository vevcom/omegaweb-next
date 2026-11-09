import { Site } from '@/lib/sites/site'
import type { AppHref } from '@/lib/sites/href'

/**
 * Where a page of the kit is served. The auth domain is the one domain that signs users in, see
 * DomainContext: a page `on: 'auth-domain'` works on the session there, so credentials are only
 * ever typed there, and the pages reached from an email land there too. A page `on: 'site'` works
 * on the session of the domain the visitor is on, where logging out has to clear the cookie.
 */
export type AuthPageHost = 'auth-domain' | 'site'

/**
 * The pages of the kit, by the sub path each sits at under a site's root. The one list of them:
 * authLinks builds the links from it, isAuthDomainPagePath answers from it, and the tests hold
 * the route folders of every mount against it, so a page never exists in one place and not the
 * others.
 */
export const authPagePaths = {
    loginForm: { path: '/login', on: 'auth-domain' },
    logout: { path: '/logout', on: 'site' },
    register: { path: '/register', on: 'auth-domain' },
    registerEmail: { path: '/register-email', on: 'auth-domain' },
    sendResetPasswordEmail: { path: '/send-reset-password-email', on: 'auth-domain' },
    verifyEmail: { path: '/verify-email', on: 'auth-domain' },
    resetPasswordForm: { path: '/reset-password-form', on: 'auth-domain' },
    linkOwUser: { path: '/link-ow-user', on: 'auth-domain' },
} as const satisfies Record<string, { path: `/${string}`, on: AuthPageHost }>

export type AuthPageName = keyof typeof authPagePaths

const authDomainPaths = new Set<string>(
    Object.values(authPagePaths).filter(page => page.on === 'auth-domain').map(page => page.path),
)

/**
 * Whether an app path is a page of the kit served on the auth domain, on whichever site it is
 * mounted: `/career/login` and `/login` both are, `/career/logout` and `/career/login/x` are not.
 */
export function isAuthDomainPagePath(href: AppHref): boolean {
    const sitePath = Site.ofPath(href).pathOn(href).replace(/[?#].*$/, '')
    return authDomainPaths.has(sitePath)
}
