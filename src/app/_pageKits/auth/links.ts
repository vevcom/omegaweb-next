import { authPagePaths } from './paths'
import { ssoStartHref } from '@/auth/sso/links'
import { defineLinks } from '@/lib/sites/defineLinks'
import { QueryParams } from '@/lib/queryParams/queryParams'
import type { AuthPageName } from './paths'
import type { AppHref } from '@/lib/sites/href'
import type { AuthPagesConfig } from './config'

export type CallbackOptions = {
    /** The app path to come back to once through the page. Without it the site's after-login page. */
    callbackUrl?: AppHref,
}

export type AuthLinks = {
    /** Signs the visitor in on the domain they are on, see ssoStartHref, landing on the callback. */
    login: (options?: CallbackOptions) => AppHref,
    /** The login form itself, on the auth domain, where the visitor types their credentials. */
    loginForm: (options?: CallbackOptions) => AppHref,
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
const token = (jwt: string) => QueryParams.token.encodeUrl(jwt)

/** The auth pages sit at every site's root, at the sub paths authPagePaths names. */
export const authLinks = defineLinks<AuthPagesConfig, AuthLinks>((href, config) => {
    const page = (name: AuthPageName, query?: string | null) => href(authPagePaths[name].path, query)
    const afterLogin = () => href(config.afterLoginPath)
    return {
        login: options => ssoStartHref(options?.callbackUrl ?? afterLogin()),
        loginForm: options => page('loginForm', callback(options)),
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
