import { defineLinks } from '@/lib/sites/defineLinks'
import { QueryParams } from '@/lib/queryParams/queryParams'
import type { AuthPagesConfig } from './config'

export type AuthLinks = {
    /** The login, coming back to `callbackUrl` once logged in, or landing on the site's after-login page. */
    login: (callbackUrl?: string) => string,
    logout: () => string,
    register: (callbackUrl?: string) => string,
    registerEmail: (callbackUrl?: string) => string,
    sendResetPasswordEmail: () => string,
    terms: () => string,
    /** The pages reached from an email, carrying its token. */
    verifyEmail: (token: string) => string,
    resetPasswordForm: (token: string) => string,
    linkOwUser: (token: string) => string,
    /** Where a login lands when there is no page to come back to. */
    afterLogin: () => string,
    afterLogout: () => string,
}

const callback = (callbackUrl?: string) => (callbackUrl ? QueryParams.callbackUrl.encodeUrl(callbackUrl) : null)
const token = (jwt: string) => QueryParams.token.encodeUrl(jwt)

/** The auth pages sit at every site's root. */
export const authLinks = defineLinks<AuthPagesConfig, AuthLinks>((href, config) => ({
    login: callbackUrl => href('/login', callback(callbackUrl)),
    logout: () => href('/logout'),
    register: callbackUrl => href('/register', callback(callbackUrl)),
    registerEmail: callbackUrl => href('/register-email', callback(callbackUrl)),
    sendResetPasswordEmail: () => href('/send-reset-password-email'),
    terms: () => href('/terms'),
    verifyEmail: jwt => href('/verify-email', token(jwt)),
    resetPasswordForm: jwt => href('/reset-password-form', token(jwt)),
    linkOwUser: jwt => href('/link-ow-user', token(jwt)),
    afterLogin: () => href(config.afterLoginPath),
    afterLogout: () => href(config.afterLogoutPath),
}))
