/**
 * The pages of the kit, by the sub path each sits at under a site's root. The one list of them:
 * authLinks builds the links from it, and the tests hold the route folders of every mount against
 * it, so a page never exists in one place and not the other. Which domain a page is served on is
 * not said here but by the page, see `servedOn` on serverPage.
 */
export const authPagePaths = {
    loginForm: '/login',
    logout: '/logout',
    register: '/register',
    registerEmail: '/register-email',
    sendResetPasswordEmail: '/send-reset-password-email',
    verifyEmail: '/verify-email',
    resetPasswordForm: '/reset-password-form',
    linkOwUser: '/link-ow-user',
} as const satisfies Record<string, `/${string}`>

export type AuthPageName = keyof typeof authPagePaths
