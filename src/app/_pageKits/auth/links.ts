import { defineLinks } from '@/lib/sites/defineLinks'
import { QueryParams } from '@/lib/queryParams/queryParams'
import type { AuthPagesConfig } from './config'

export type CallbackOptions = {
    /** The app path to come back to once through the page. Without it the site's after-login page. */
    callbackUrl?: string,
}

export type AuthLinks = {
    login: (options?: CallbackOptions) => string,
    logout: () => string,
    register: (options?: CallbackOptions) => string,
    registerEmail: (options?: CallbackOptions) => string,
    sendResetPasswordEmail: () => string,
    terms: () => string,
    /** The pages reached from an email, carrying its token. */
    verifyEmail: (token: string) => string,
    resetPasswordForm: (token: string) => string,
    linkOwUser: (token: string) => string,
    /** Where another domain sends a login it hands over, see src/app/api/sso. */
    sessionTransfer: (options: { ticket: string | null, callbackUrl: string }) => string,
    /** Where a login lands when there is no page to come back to. */
    afterLogin: () => string,
    afterLogout: () => string,
}

const callback = (options?: CallbackOptions) =>
    (options?.callbackUrl ? QueryParams.callbackUrl.encodeUrl(options.callbackUrl) : null)
const token = (jwt: string) => QueryParams.token.encodeUrl(jwt)

/** The auth pages sit at every site's root. */
export const authLinks = defineLinks<AuthPagesConfig, AuthLinks>((href, config) => ({
    login: options => href('/login', callback(options)),
    logout: () => href('/logout'),
    register: options => href('/register', callback(options)),
    registerEmail: options => href('/register-email', callback(options)),
    sendResetPasswordEmail: () => href('/send-reset-password-email'),
    terms: () => href('/terms'),
    verifyEmail: jwt => href('/verify-email', token(jwt)),
    resetPasswordForm: jwt => href('/reset-password-form', token(jwt)),
    linkOwUser: jwt => href('/link-ow-user', token(jwt)),
    sessionTransfer: ({ ticket, callbackUrl }) =>
        href('/sso', new URLSearchParams({ ...(ticket ? { ticket } : {}), callbackUrl }).toString()),
    afterLogin: () => href(config.afterLoginPath),
    afterLogout: () => href(config.afterLogoutPath),
}))
