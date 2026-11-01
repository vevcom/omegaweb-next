import { siteOfPath, sitePagesPath, siteUrl } from './sites'
import { QueryParams } from '@/lib/queryParams/queryParams'
import type { Site } from './sites'

/** The pages of the sign in and sign up flow. Every site has them under its base path. */
export const authPages = {
    login: '/login',
    logout: '/logout',
    register: '/register',
    registerEmail: '/register-email',
    verifyEmail: '/verify-email',
    sendResetPasswordEmail: '/send-reset-password-email',
    resetPasswordForm: '/reset-password-form',
    linkOwUser: '/link-ow-user',
    terms: '/terms',
} as const

export type AuthPage = keyof typeof authPages

export function authPath(site: Site, page: AuthPage): string {
    return sitePagesPath({ site, path: authPages[page] })
}

/** The login of the site a path belongs to, coming back to that path once logged in. */
export function loginHref(currentPath: string): string {
    return `${authPath(siteOfPath(currentPath), 'login')}?${QueryParams.callbackUrl.encodeUrl(currentPath)}`
}

/** An auth page as a link in an email. */
export function authUrl(site: Site, page: AuthPage): string {
    return `${siteUrl(site)}${authPages[page]}`
}
