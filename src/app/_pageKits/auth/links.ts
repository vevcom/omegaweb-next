import { authPagePaths } from './paths'
import { ssoStartHref } from '@/auth/sso/links'
import { defineLinks } from '@/lib/sites/defineLinks'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { appHref } from '@/lib/sites/href'
import type { AuthPageName } from './paths'
import type { SearchParams } from '@/app/ServerPage'
import type { AppHref } from '@/lib/sites/href'
import type { AuthPagesConfig, SecondLogin } from './config'

export type CallbackOptions = {
    /** The app path to come back to once through the page. Without it the site's after-login page. */
    callbackUrl?: AppHref,
}

type LoginFormOptions = CallbackOptions & {
    /**
     * The page the visitor was going to, when the callback resumes an authorization instead, so the
     * form can carry it to the site's second login.
     */
    destination?: AppHref,
}

export type AuthLinks = {
    /** Signs the visitor in on the domain they are on, see ssoStartHref, landing on the callback. */
    login: (options?: CallbackOptions) => AppHref,
    /** The login form itself, on the auth domain, where the visitor types their credentials. */
    loginForm: (options?: LoginFormOptions) => AppHref,
    logout: () => AppHref,
    register: (options?: CallbackOptions) => AppHref,
    registerEmail: (options?: CallbackOptions) => AppHref,
    sendResetPasswordEmail: () => AppHref,
    terms: () => AppHref,
    /** The pages reached from an email, carrying its token. */
    verifyEmail: (token: string) => AppHref,
    resetPasswordForm: (token: string) => AppHref,
    linkOwUser: (token: string) => AppHref,
    /** Where a login lands when there is no page to come back to. */
    afterLogin: () => AppHref,
    afterLogout: () => AppHref,
}

const callback = (options?: CallbackOptions) =>
    (options?.callbackUrl ? QueryParams.callbackUrl.encodeUrl(options.callbackUrl) : null)
const destination = (options?: LoginFormOptions) =>
    (options?.destination ? QueryParams.destination.encodeUrl(options.destination) : null)
const token = (jwt: string) => QueryParams.token.encodeUrl(jwt)

/** The auth pages sit at every site's root, at the sub paths authPagePaths names. */
export const authLinks = defineLinks<AuthPagesConfig, AuthLinks>((href, config) => {
    const page = (name: AuthPageName, query?: string | null) => href(authPagePaths[name], query)
    const afterLogin = () => href(config.afterLoginPath)
    return {
        login: options => ssoStartHref(options?.callbackUrl ?? afterLogin()),
        loginForm: options => page('loginForm', joinQuery(callback(options), destination(options))),
        logout: () => page('logout'),
        register: options => page('register', callback(options)),
        registerEmail: options => page('registerEmail', callback(options)),
        sendResetPasswordEmail: () => page('sendResetPasswordEmail'),
        // A page of the site, not of the kit: the terms are read logged out, on the site's own domain.
        terms: () => href('/terms'),
        verifyEmail: jwt => page('verifyEmail', token(jwt)),
        resetPasswordForm: jwt => page('resetPasswordForm', token(jwt)),
        linkOwUser: jwt => page('linkOwUser', token(jwt)),
        afterLogin,
        afterLogout: () => href(config.afterLogoutPath),
    }
})

/** The site's second login, see AuthPagesConfig, landing on the callback. */
export function secondLoginHref(secondLogin: SecondLogin, options?: CallbackOptions): AppHref {
    if (!options?.callbackUrl) return secondLogin.href
    return appHref(`${secondLogin.href}?${QueryParams.callbackUrl.encodeUrl(options.callbackUrl)}`)
}

/**
 * The page the login form's switch to the second login carries: the `destination` the authorize
 * endpoint hands on, or else the form's own callbackUrl. Without the endpoint, on the auth domain
 * itself, that is the page. Through it without a destination, because the page was too long or the
 * url was made by hand, it is the authorization, which the second login refuses for its frontpage.
 */
export function secondLoginCallbackUrl(searchParams: SearchParams): AppHref | null {
    return QueryParams.destination.decode(searchParams) ?? QueryParams.callbackUrl.decode(searchParams)
}

function joinQuery(...parts: (string | null)[]): string | null {
    return parts.filter(part => part !== null).join('&') || null
}
